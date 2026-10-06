// The email analysis stage, run one conversation at a time by the analyzeEmails
// worker. Gmail import and analysis are separate stages: the Gmail sync only
// imports messages and marks them pending; this module analyzes each message
// independently, so a slow or failed analysis never blocks other messages, and
// a retried message can never duplicate emails, opportunities, or history.
//
// The caller passes the client to use for entity operations: the signed-in
// manager's client (frontend kick / retry) or the service role (the Email
// Analysis workflow trigger, which has no signed-in user — isolation is
// preserved because the conversation's own restaurant_id scopes everything).

import { analyzeEmail, opportunityTypeFor, conversationUpdatesFor } from "./emailAnalysis.ts";
import { linkFollowup } from "./dedupe.ts";
import { calendarAnalysisContext } from "./calendarSchedule.ts";
import {
  loadKnowledge,
  loadRecentFeedback,
  formatKnowledgeForPrompt,
  formatAdminContextForPrompt,
  formatCorrectionsForPrompt,
  formatResponseTemplatesForPrompt,
} from "./restaurantKnowledge.ts";

// How many messages one batch run analyzes. The workflow handles the rest,
// one message per run — no batch size can stall the queue.
export const BATCH_MAX = 5;

// A "processing" claim older than this is considered abandoned (a crashed
// run) and may be re-claimed.
const PROCESSING_FRESH_MS = 10 * 60 * 1000;

function processingIsFresh(convo) {
  if (!convo.analysis_started_at) return false;
  const started = new Date(convo.analysis_started_at).getTime();
  return Number.isFinite(started) && Date.now() - started < PROCESSING_FRESH_MS;
}

async function getConversation(client, id) {
  try {
    return await client.entities.Conversation.get(id);
  } catch (e) {
    return null;
  }
}

// Analyze ONE queued conversation. Idempotent: only a "pending" (or abandoned
// "processing") message is analyzed; a concurrent run is detected by the
// optimistic claim below and walks away; an already-analyzed message is never
// re-analyzed and never duplicated.
export async function analyzeQueuedConversation(client, { restaurantId, conversationId }) {
  // Fresh fetch — the queue state may have changed since the trigger fired.
  const convo = await getConversation(client, conversationId);
  if (!convo || convo.restaurant_id !== restaurantId) return { skipped: true, reason: "not_found" };
  if (convo.is_demo) return { skipped: true, reason: "demo" };
  if (convo.analysis_state === "analyzed") return { skipped: true, reason: "already_analyzed" };
  if (convo.analysis_state === "processing" && processingIsFresh(convo)) {
    return { skipped: true, reason: "in_progress" };
  }
  // Only queued messages are analyzed — a call can never start work on an
  // arbitrary message. A stale "processing" claim (crashed run) is re-claimed.
  const reclaimable = convo.analysis_state === "processing" && !processingIsFresh(convo);
  if (convo.analysis_state !== "pending" && !reclaimable) {
    return { skipped: true, reason: "not_queued" };
  }

  // Optimistic claim: mark processing with this run's timestamp — a second
  // concurrent run sees a different claim and walks away. Nothing is created
  // before this claim is verified.
  const startedAt = new Date().toISOString();
  await client.entities.Conversation.update(convo.id, {
    analysis_state: "processing",
    analysis_started_at: startedAt,
  });
  const claimed = await getConversation(client, conversationId);
  if (!claimed || claimed.analysis_state !== "processing" || claimed.analysis_started_at !== startedAt) {
    return { skipped: true, reason: "another_run" };
  }

  let restaurantName = "the restaurant";
  try {
    const restaurant = await client.entities.Restaurant.get(restaurantId);
    if (restaurant && restaurant.name) restaurantName = restaurant.name;
  } catch (e) {
    // fall back to the default name
  }

  const [knowledgeRecord, feedback] = await Promise.all([
    loadKnowledge(client, restaurantId),
    loadRecentFeedback(client, restaurantId),
  ]);

  // The analyzed message and the customer's identity come from the latest
  // message the CUSTOMER actually sent in this thread — never from the
  // restaurant's own addresses or the logged-in manager.
  const msgPage = await client.entities.ConversationMessage.filter(
    { restaurant_id: restaurantId, conversation_id: convo.id },
    null,
    100
  );
  const threadMsgs = (msgPage.items || []).slice().sort(
    (a, b) => new Date(a.received_at || 0).getTime() - new Date(b.received_at || 0).getTime()
  );
  const ownAddresses = new Set(
    [knowledgeRecord ? knowledgeRecord.contact_email : null]
      .map((e) => (e || "").toLowerCase().trim())
      .filter(Boolean)
  );
  const customerMsgs = threadMsgs.filter(
    (m) => !ownAddresses.has((m.sender_email || "").toLowerCase().trim())
  );
  const latest = customerMsgs[customerMsgs.length - 1] || threadMsgs[threadMsgs.length - 1];
  const body = latest ? latest.body : convo.message;
  const senderName = (latest && (latest.sender_name || latest.sender_email)) || convo.customer_name;
  const senderEmail = (latest && latest.sender_email) || convo.customer_email;

  let analysis;
  try {
    analysis = await analyzeEmail(client, restaurantName, {
      senderName,
      senderEmail,
      subject: convo.subject,
      body,
    }, {
      knowledgeContext: formatKnowledgeForPrompt(knowledgeRecord),
      adminContext: formatAdminContextForPrompt(knowledgeRecord, {
        senderEmail: convo.customer_email,
        subject: convo.subject,
        body,
      }),
      corrections: formatCorrectionsForPrompt(feedback),
      templatesContext: formatResponseTemplatesForPrompt(knowledgeRecord),
      calendarContext: await calendarAnalysisContext(client, knowledgeRecord, convo.subject, body),
      timezone: knowledgeRecord ? knowledgeRecord.timezone : null,
      signature: knowledgeRecord && knowledgeRecord.email_signature ? knowledgeRecord.email_signature : null,
    });
  } catch (e) {
    // Analysis failed — isolated to this message. Mark it retryable and move
    // on; every other message keeps analyzing.
    await client.entities.Conversation.update(convo.id, {
      analysis_state: "failed",
      analysis_completed_at: null,
      analysis_attempts: (convo.analysis_attempts || 0) + 1,
      analysis_error: "Relay couldn't finish analyzing this message. Retry analysis.",
      analysis_status: "Needs review",
      status: convo.status === "Reviewed" || convo.status === "Archived" ? convo.status : "New",
    });
    return { failed: true, reason: "analysis_error" };
  }

  const classification = analysis.classification || "routine";
  const managerDraft = convo.draft_edited || convo.reply_status === "Reply recorded";
  const finish = (extra) =>
    client.entities.Conversation.update(convo.id, {
      ...extra,
      analysis_state: "analyzed",
      analysis_completed_at: new Date().toISOString(),
      analysis_error: "",
    });

  if (classification === "opportunity") {
    // A follow-up inside a thread that already has its own matter continues
    // THAT matter — it never becomes a duplicate opportunity.
    if (convo.opportunity_id) {
      let existingOpp = null;
      try {
        existingOpp = await client.entities.Opportunity.get(convo.opportunity_id);
      } catch (e) { /* removed or inaccessible */ }
      if (existingOpp) {
        await linkFollowup(client, {
          restaurantId,
          opportunity: existingOpp,
          customerName: senderName,
          priority: analysis.priority,
          conversationId: convo.id,
        });
        await finish(conversationUpdatesFor("opportunity", analysis, { preserveManagerDraft: managerDraft }));
        return { analyzed: true, classification: "Opportunity", linked_existing: true };
      }
    }
    // Fresh duplicate check before creating — a double-triggered run must
    // never create two opportunities for the same message.
    const refreshed = await getConversation(client, convo.id);
    if (refreshed && refreshed.opportunity_id) {
      return { skipped: true, reason: "linked_elsewhere" };
    }
    const oppType = opportunityTypeFor(analysis.category) || analysis.opportunity_type || "Business inquiry";
    const originalMessage = `Subject: ${convo.subject}\n\n${body}`;
    const opp = await client.entities.Opportunity.create({
      restaurant_id: restaurantId,
      type: oppType,
      title: analysis.title || convo.subject,
      description: analysis.description || analysis.why_flagged,
      customer_name: senderName,
      customer_email: senderEmail,
      estimated_value_min: analysis.has_value_estimate ? analysis.estimated_value_min : null,
      estimated_value_max: analysis.has_value_estimate ? analysis.estimated_value_max : null,
      value_confidence: analysis.has_value_estimate ? analysis.value_confidence || "Medium" : null,
      value_basis: analysis.has_value_estimate ? analysis.value_basis : null,
      priority: analysis.priority || "medium",
      status: "New",
      draft_status: "Draft",
      recommended_action: analysis.recommended_action || "Review and respond to this inquiry",
      source: "Gmail",
      original_message: originalMessage.slice(0, 8000),
      why_identified:
        [analysis.customer_facts, analysis.relay_assessment, analysis.knowledge_used].filter(Boolean).join(" ") +
        ` Relay flagged this with ${analysis.confidence || "Medium"} confidence.`,
      draft_response: analysis.draft_response || "",
      last_analyzed_at: new Date().toISOString(),
      is_demo: false,
    });

    await finish({
      opportunity_id: opp.id,
      ...conversationUpdatesFor("opportunity", analysis, { preserveManagerDraft: managerDraft }),
    });

    if (analysis.draft_response) {
      await client.entities.Action.create({
        restaurant_id: restaurantId,
        opportunity_id: opp.id,
        type: "Draft response",
        description: `Draft a response to ${senderName} regarding "${convo.subject}".`,
        status: "Pending Approval",
        requires_approval: true,
      });
    }
    await client.entities.Activity.create({
      restaurant_id: restaurantId,
      opportunity_id: opp.id,
      conversation_id: convo.id,
      type: "opportunity_identified",
      description: `Opportunity identified: ${opp.title} from ${senderName} (Gmail)`,
    });
    if (analysis.draft_response) {
      await client.entities.Activity.create({
        restaurant_id: restaurantId,
        opportunity_id: opp.id,
        conversation_id: convo.id,
        type: "draft_prepared",
        description: `Draft response created for ${senderName}'s ${oppType.toLowerCase()}`,
      });
    }
    return { analyzed: true, classification: "Opportunity", opportunity_created: true };
  }

  const outcome = conversationUpdatesFor(classification, analysis, {
    preserveManagerDraft: managerDraft,
    previousDraft: convo.draft_response || "",
    previousRelayDraft: convo.relay_draft || "",
  });
  await finish(outcome);
  return { analyzed: true, classification: outcome.analysis_status || classification };
}