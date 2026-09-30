// Manager-initiated re-analysis of one conversation using the CURRENT
// Restaurant Knowledge. Never sends an email, never silently overwrites a
// manager-edited draft, and always preserves the previous analysis for audit.

import {
  analyzeEmail,
  opportunityTypeFor,
  conversationUpdatesFor,
} from "./emailAnalysis.ts";
import {
  loadKnowledge,
  loadRecentFeedback,
  formatKnowledgeForPrompt,
  formatAdminContextForPrompt,
  formatCorrectionsForPrompt,
} from "./restaurantKnowledge.ts";

// Readable snapshot of the analysis as it stands before a re-analysis —
// stored on the record so the previous version stays recoverable.
export function previousAnalysisSnapshot({ convo, opportunity }) {
  const parts = [];
  if (convo && convo.analysis_status) {
    parts.push(`Classification: ${convo.analysis_status}${convo.category ? ` (${convo.category})` : ""}`);
  }
  if (convo && convo.why_flagged) parts.push(`Reasoning: ${convo.why_flagged}`);
  if (convo && convo.knowledge_used) parts.push(`Restaurant knowledge used: ${convo.knowledge_used}`);
  if (opportunity && opportunity.recommended_action) parts.push(`Recommended action: ${opportunity.recommended_action}`);
  const draft =
    (opportunity && opportunity.draft_response) ||
    (convo && (convo.draft_response || convo.relay_draft));
  if (draft) parts.push(`Draft: ${draft}`);
  return parts.join("\n\n");
}

// A draft the manager edited or already recorded is manager-controlled
// content — re-analysis may only replace it after explicit confirmation.
export function isManagerControlled({ convo, opportunity }) {
  return !!(
    (convo && (convo.draft_edited || convo.reply_status === "Reply recorded")) ||
    (opportunity && (opportunity.draft_status === "Edited" || opportunity.draft_status === "Approved"))
  );
}

export async function reanalyzeOne(base44, { restaurantId, restaurantName, convo, messages, confirm }) {
  if (!convo.analysis_status || convo.analysis_status === "Not analyzed") {
    return { error: "This message has not been analyzed yet." };
  }

  let opportunity = null;
  if (convo.opportunity_id) {
    try {
      opportunity = await base44.entities.Opportunity.get(convo.opportunity_id);
    } catch (e) {
      opportunity = null;
    }
  }

  if (!confirm && isManagerControlled({ convo, opportunity })) {
    return { requiresConfirmation: true, managerEdited: true };
  }

  const [knowledge, feedback] = await Promise.all([
    loadKnowledge(base44, restaurantId),
    loadRecentFeedback(base44, restaurantId),
  ]);

  // Latest thread message — the same one the analysis addresses.
  const threadMsgs = (messages || [])
    .filter((m) => m.conversation_id === convo.id)
    .sort((a, b) => new Date(a.received_at || 0).getTime() - new Date(b.received_at || 0).getTime());
  const latest = threadMsgs[threadMsgs.length - 1];
  const body = latest ? latest.body : convo.message;

  // Did Restaurant Knowledge change since this analysis was generated?
  const knowledgeChanged = !!(
    knowledge && knowledge.updated_date && convo.last_analyzed_at &&
    new Date(knowledge.updated_date).getTime() > new Date(convo.last_analyzed_at).getTime()
  );

  // Snapshot BEFORE anything changes — the previous analysis survives.
  const snapshot = previousAnalysisSnapshot({ convo, opportunity });
  const classificationBefore = convo.analysis_status;

  const analysis = await analyzeEmail(base44, restaurantName, {
    senderName: convo.customer_name,
    senderEmail: convo.customer_email,
    subject: convo.subject,
    body,
  }, {
    knowledgeContext: formatKnowledgeForPrompt(knowledge),
    adminContext: formatAdminContextForPrompt(knowledge, {
      senderEmail: convo.customer_email,
      subject: convo.subject,
      body,
    }),
    corrections: formatCorrectionsForPrompt(feedback),
    timezone: knowledge ? knowledge.timezone : null,
  });

  const classification = analysis.classification || "routine";
  const now = new Date().toISOString();
  const summary = {
    previousAnalysisPreserved: !!snapshot,
    knowledgeChanged,
    classificationBefore,
    classificationAfter: conversationUpdatesFor(classification, analysis).analysis_status,
    opportunityUpdated: false,
    opportunityCreated: false,
    opportunityRemoved: false,
    draftReplaced: false,
  };

  let oppId = opportunity ? opportunity.id : "";
  if (classification === "opportunity") {
    const oppType = opportunityTypeFor(analysis.category) || analysis.opportunity_type || "Business inquiry";
    const fields = {
      type: oppType,
      title: analysis.title || convo.subject,
      description: analysis.description || analysis.why_flagged,
      estimated_value_min: analysis.has_value_estimate ? analysis.estimated_value_min : null,
      estimated_value_max: analysis.has_value_estimate ? analysis.estimated_value_max : null,
      value_confidence: analysis.has_value_estimate ? analysis.value_confidence || "Medium" : null,
      value_basis: analysis.has_value_estimate ? analysis.value_basis : null,
      priority: analysis.priority || "medium",
      recommended_action: analysis.recommended_action || "Review and respond to this inquiry",
      source: convo.source || "Gmail",
      original_message: `Subject: ${convo.subject}\n\n${body}`.slice(0, 8000),
      why_identified:
        [analysis.customer_facts, analysis.relay_assessment, analysis.knowledge_used].filter(Boolean).join(" ") +
        ` Relay flagged this with ${analysis.confidence || "Medium"} confidence.`,
      draft_response: analysis.draft_response || "",
      draft_status: "Draft",
      previous_analysis: snapshot,
      last_analyzed_at: now,
    };
    if (opportunity) {
      await base44.entities.Opportunity.update(opportunity.id, fields);
      summary.opportunityUpdated = true;
    } else {
      const opp = await base44.entities.Opportunity.create({
        restaurant_id: restaurantId,
        customer_name: convo.customer_name,
        customer_email: convo.customer_email,
        status: "New",
        is_demo: !!convo.is_demo,
        ...fields,
      });
      oppId = opp.id;
      summary.opportunityCreated = true;
      if (analysis.draft_response) {
        await base44.entities.Action.create({
          restaurant_id: restaurantId,
          opportunity_id: opp.id,
          type: "Draft response",
          description: `Draft a response to ${convo.customer_name} regarding "${convo.subject}".`,
          status: "Pending Approval",
          requires_approval: true,
          is_demo: !!convo.is_demo,
        });
      }
    }
    if (fields.draft_response) summary.draftReplaced = true;
    await base44.entities.Conversation.update(convo.id, {
      opportunity_id: oppId || "",
      message: body.slice(0, 4000),
      ...conversationUpdatesFor("opportunity", analysis),
      previous_analysis: snapshot,
    });
  } else {
    // No longer an opportunity (or never was): recategorize. An untouched,
    // auto-created opportunity is removed; a manager-touched one stays.
    const untouched = !!(
      opportunity &&
      ["New", "Needs Attention"].includes(opportunity.status) &&
      opportunity.draft_status === "Draft"
    );
    if (untouched) {
      await base44.entities.Action.deleteMany({ opportunity_id: opportunity.id });
      await base44.entities.Activity.deleteMany({ opportunity_id: opportunity.id });
      await base44.entities.Opportunity.delete(opportunity.id);
      summary.opportunityRemoved = true;
      oppId = "";
    }
    const outcome = conversationUpdatesFor(classification, analysis);
    await base44.entities.Conversation.update(convo.id, {
      ...(oppId === "" ? { opportunity_id: "" } : {}),
      message: body.slice(0, 4000),
      ...outcome,
      previous_analysis: snapshot,
    });
  }

  // Exactly one history entry per re-analysis action.
  const description = opportunity && summary.opportunityUpdated
    ? `Opportunity re-analyzed using updated Restaurant Profile: ${opportunity.title}`
    : `Re-analyzed using current Restaurant Profile: ${convo.subject || "this message"}`;
  const suffixes = [];
  if (knowledgeChanged) suffixes.push("Restaurant Profile had changed since the previous analysis");
  if (classificationBefore !== summary.classificationAfter) {
    suffixes.push(`classification changed from ${classificationBefore} to ${summary.classificationAfter}`);
  }
  await base44.entities.Activity.create({
    restaurant_id: restaurantId,
    opportunity_id: oppId || "",
    conversation_id: convo.id,
    type: "reanalyzed",
    description: description + (suffixes.length ? ` — ${suffixes.join("; ")}` : ""),
    is_demo: !!convo.is_demo,
  });

  return { ...summary, analysis };
}