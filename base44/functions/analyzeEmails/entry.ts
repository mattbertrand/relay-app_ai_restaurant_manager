import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { analyzeQueuedConversation, BATCH_MAX } from "../../shared/emailAnalysisRunner.ts";

// The email analysis worker. Gmail import and analysis are SEPARATE stages:
// the sync only imports messages and marks them pending; this worker analyzes
// them independently — one message per invocation from the Email Analysis
// workflow trigger, or a small oldest-first batch as a catch-up. A slow or
// failed analysis of one message never blocks any other message, and a failed
// message is retryable without duplicating anything.
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

    // Single-message mode — the Email Analysis workflow or a manager retry.
    if (payload.conversation_id) {
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
    for (const convo of page.items || []) {
      results.push(
        await analyzeQueuedConversation(base44, { restaurantId, conversationId: convo.id })
      );
    }
    return Response.json({
      examined: (page.items || []).length,
      analyzed: results.filter((r) => r.analyzed).length,
      failed: results.filter((r) => r.failed).length,
      skipped: results.filter((r) => r.skipped).length,
      remaining_pending: Math.max(0, (page.items || []).length - results.filter((r) => r.skipped || r.failed).length),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}