import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { analyzeQueuedConversation, BATCH_MAX, processingIsFresh } from "../../shared/emailAnalysisRunner.ts";
import { sleep, withBackoff, isRateLimitError } from "../../shared/apiGuard.ts";

// The email analysis worker. Gmail import and analysis are SEPARATE stages:
// the sync only imports messages and marks them pending; this worker analyzes
// them independently — one message per invocation from the Email Analysis
// workflow trigger, or a small oldest-first batch as a catch-up. A slow or
// failed analysis of one message never blocks any other message, and a failed
// message is retryable without duplicating anything.
//
// The recovery sweep (payload.recovery — run by the Email Analysis Recovery
// schedule) makes the queue self-healing: messages whose analysis run died
// mid-way ("processing" claims that were never finished) or failed transiently
// are automatically re-queued with exponential backoff, and the oldest queued
// messages are analyzed directly. The manager never has to re-kick anything.

// How many queued messages one recovery sweep analyzes directly.
const RECOVERY_DRAIN_MAX = 3;
// A failed message is retried automatically at most this many times.
const MAX_AUTO_RETRIES = 5;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    let user = null;
    try {
      user = await base44.auth.me();
    } catch (e) {
      // The workflow trigger has no signed-in user.
    }

    // ---- Recovery sweep: requeue stuck/failed, drain the oldest queued. ----
    // Runs with the service role over this app's own data; every operation is
    // an idempotent queue-state change (claims + freshness checks make each
    // message analyzed exactly once). Only Relay's own analysis queue state
    // is touched — never message content.
    if (payload.recovery) {
      const svc = base44.asServiceRole;
      const page = await withBackoff(() =>
        svc.entities.Conversation.filter(
          {
            source: "Gmail",
            is_demo: false,
            analysis_state: { $in: ["pending", "processing", "failed"] },
          },
          { sort: "created_date", limit: 200 }
        )
      );
      const items = page.items || [];
      const now = Date.now();
      const queue = [];
      let requeued = 0;
      for (const c of items) {
        try {
          if (c.analysis_state === "processing") {
            // A claim whose run died (crash, timeout, rate limit) is re-queued.
            if (!processingIsFresh(c)) {
              await withBackoff(() =>
                svc.entities.Conversation.update(c.id, { analysis_state: "pending" })
              );
              requeued++;
              queue.push(c);
            }
          } else if (c.analysis_state === "failed") {
            const attempts = c.analysis_attempts || 0;
            if (attempts >= MAX_AUTO_RETRIES) continue;
            const lastAttempt = new Date(c.analysis_started_at || c.updated_date || 0).getTime();
            // Exponential backoff between automatic retries: 90s per attempt
            // already made, so repeated failures slow down instead of storming.
            if (Number.isFinite(lastAttempt) && now - lastAttempt < attempts * 90 * 1000) continue;
            await withBackoff(() =>
              svc.entities.Conversation.update(c.id, { analysis_state: "pending" })
            );
            requeued++;
            queue.push(c);
          } else {
            // pending — drained directly below (also covers a missed trigger).
            queue.push(c);
          }
        } catch (e) {
          console.log(`recovery: could not requeue ${c.id}: ${e.message}`);
        }
      }
      const results = [];
      for (const c of queue.slice(0, RECOVERY_DRAIN_MAX)) {
        try {
          results.push(
            await analyzeQueuedConversation(svc, { restaurantId: c.restaurant_id, conversationId: c.id })
          );
        } catch (e) {
          if (isRateLimitError(e)) {
            console.log(`recovery: rate limited after ${results.length} messages — pausing until next sweep`);
            break;
          }
          console.log(`recovery: analysis of ${c.id} errored: ${e.message}`);
        }
        await sleep(800); // pacing between messages
      }
      const analyzed = results.filter((r) => r.analyzed).length;
      const failed = results.filter((r) => r.failed).length;
      console.log(
        `recovery: ${items.length} queued/stuck · requeued ${requeued} · analyzed ${analyzed} · failed ${failed} · remaining ${Math.max(0, queue.length - results.length)}`
      );
      return Response.json({
        recovery: true,
        found: items.length,
        requeued,
        analyzed,
        failed,
        remaining: Math.max(0, queue.length - results.length),
      });
    }

    // Single-message mode — the Email Analysis workflow or a manager retry.
    if (payload.conversation_id) {
      // A sync can queue many messages at once, which fires one run per
      // message. A short random jitter spreads those runs out so they don't
      // all hit the API in the same instant.
      await sleep(Math.floor(Math.random() * 3000));
      // The workflow path has no user: act through the service role, scoped
      // strictly to the conversation's own restaurant.
      const client = user ? base44 : base44.asServiceRole;
      let restaurantId = user
        ? user.restaurant_id || (user.data && user.data.restaurant_id)
        : null;
      if (!restaurantId) {
        let convo = null;
        try {
          convo = await client.entities.Conversation.get(payload.conversation_id);
        } catch (e) { /* not found */ }
        if (!convo) return Response.json({ skipped: true, reason: "not_found" });
        restaurantId = convo.restaurant_id;
      }
      const result = await analyzeQueuedConversation(client, {
        restaurantId,
        conversationId: payload.conversation_id,
      });
      console.log(`analyze: ${payload.conversation_id} → ${JSON.stringify(result)}`);
      return Response.json(result);
    }

    // Batch mode — a signed-in manager kicks the queue (oldest first). Used
    // right after a sync so analysis visibly starts, and as a catch-up for
    // any message whose trigger was missed.
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const restaurantId = user.restaurant_id || (user.data && user.data.restaurant_id);
    if (!restaurantId) {
      return Response.json({ error: 'No restaurant is set up for this account yet.' }, { status: 400 });
    }
    const page = await base44.entities.Conversation.filter(
      {
        restaurant_id: restaurantId,
        source: "Gmail",
        is_demo: false,
        analysis_state: { $in: ["pending", "processing"] },
      },
      { sort: "created_date", limit: BATCH_MAX }
    );
    const results = [];
    let paused = false;
    for (const convo of page.items || []) {
      try {
        results.push(
          await analyzeQueuedConversation(base44, { restaurantId, conversationId: convo.id })
        );
      } catch (e) {
        if (isRateLimitError(e)) {
          // Back off instead of hammering — the per-message triggers and the
          // recovery sweep finish the rest without any manager action.
          paused = true;
          console.log(`batch: rate limited after ${results.length} messages — pausing`);
          break;
        }
        console.log(`batch: analysis of ${convo.id} errored: ${e.message}`);
        results.push({ failed: true, reason: "error" });
      }
      await sleep(600); // pacing between messages
    }
    return Response.json({
      examined: (page.items || []).length,
      analyzed: results.filter((r) => r.analyzed).length,
      failed: results.filter((r) => r.failed).length,
      skipped: results.filter((r) => r.skipped).length,
      paused,
      remaining: Math.max(0, (page.items || []).length - results.filter((r) => r.analyzed).length),
    });
  } catch (error) {
    console.log(`analyzeEmails: failed: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
}