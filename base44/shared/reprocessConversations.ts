import {
  analyzeEmail,
  opportunityTypeFor,
  conversationUpdatesFor,
  ANALYSIS_VERSION,
} from "./emailAnalysis.ts";
import {
  loadKnowledge,
  loadRecentFeedback,
  formatKnowledgeForPrompt,
  formatAdminContextForPrompt,
  formatCorrectionsForPrompt,
} from "./restaurantKnowledge.ts";

// Safety cap per run — Gmail re-analysis makes one model call per message, so
// a run stays bounded in time and credit use. Remaining messages are picked up
// by the next run (the Inbox sync re-analyzes new arrivals automatically).
const MAX_REPROCESS = 20;
const REPROCESSABLE = ["Opportunity", "No opportunity", "Attention", "Routine", "Administrative", "Spam", "Needs review"];

// Reprocessing re-classifies a message, but it never resets what the manager
// has already done with it: reviewed/archived inbox state is preserved.
const inboxStatus = (convo) =>
  convo.status === "Reviewed" || convo.status === "Archived" ? convo.status : "New";

async function findOpportunity(base44, id) {
  try {
    return await base44.entities.Opportunity.get(id);
  } catch (e) {
    return null;
  }
}

// Re-runs the current analysis on live Gmail conversations that were classified
// by an earlier version of the classifier, and reconciles their opportunities:
// auto-created, untouched drafts are updated or removed; anything the manager
// has already reviewed, edited, or approved is left alone. Each conversation is
// analyzed strictly on its own merits — nothing is linked by sender.
export async function reprocessConversations({ base44, restaurantId, restaurantName, convos, messages }) {
  const opps = await base44.entities.Opportunity.filter({ restaurant_id: restaurantId }, null, 500);
  const [knowledgeRecord, feedback] = await Promise.all([
    loadKnowledge(base44, restaurantId),
    loadRecentFeedback(base44, restaurantId),
  ]);
  const knowledgeContext = formatKnowledgeForPrompt(knowledgeRecord);
  const corrections = formatCorrectionsForPrompt(feedback);
  const summary = {
    connected: true,
    reprocessed: 0,
    followupsLinked: 0,
    reopened: 0,
    opportunitiesCreated: 0,
    opportunitiesUpdated: 0,
    opportunitiesRemoved: 0,
    attentionFlagged: 0,
    needsReview: 0,
    duplicateImportsMerged: 0,
  };

  // Historical cleanup: early sync runs imported the same Gmail message as two
  // conversation records (same gmail_message_id). Collapse the copies into the
  // stronger record (manager-controlled first, then linked-opportunity, then
  // oldest); manager-controlled copies are never discarded, and an untouched
  // draft opportunity on the duplicate is removed with it.
  const removedDuplicateIds = new Set();
  const byMsgId = new Map();
  for (const c of convos) {
    if (c.source !== "Gmail" || c.is_demo || !c.gmail_message_id) continue;
    const list = byMsgId.get(c.gmail_message_id);
    if (list) list.push(c);
    else byMsgId.set(c.gmail_message_id, [c]);
  }
  for (const group of byMsgId.values()) {
    if (group.length < 2) continue;
    const managerControlled = (c) =>
      c.draft_edited || c.reply_status === "Reply recorded" || c.status === "Reply recorded";
    const keepers = group.filter(managerControlled);
    const pool = keepers.length ? keepers : group;
    const keeper = [...pool].sort(
      (a, b) =>
        (b.opportunity_id ? 1 : 0) - (a.opportunity_id ? 1 : 0) ||
        new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
    )[0];
    for (const dupe of group) {
      if (dupe.id === keeper.id || managerControlled(dupe)) continue;
      try {
        await base44.entities.ConversationMessage.updateMany(
          { restaurant_id: restaurantId, conversation_id: dupe.id },
          { $set: { conversation_id: keeper.id } }
        );
      } catch (e) {
        /* no messages to move */
      }
      if (dupe.opportunity_id && dupe.opportunity_id !== keeper.opportunity_id) {
        try {
          const dupOpp = await base44.entities.Opportunity.get(dupe.opportunity_id);
          if (["New", "Needs Attention"].includes(dupOpp.status) && dupOpp.draft_status === "Draft") {
            await base44.entities.Action.deleteMany({ opportunity_id: dupOpp.id });
            await base44.entities.Activity.deleteMany({ opportunity_id: dupOpp.id });
            await base44.entities.Opportunity.delete(dupOpp.id);
            summary.opportunitiesRemoved++;
          }
        } catch (e) {
          /* already removed */
        }
      }
      await base44.entities.Conversation.delete(dupe.id);
      removedDuplicateIds.add(dupe.id);
      summary.duplicateImportsMerged++;
    }
  }

  // An opportunity belongs to exactly ONE conversation. If several
  // conversations reference the same opportunity, that link is a stale
  // same-sender mis-association — treat it as no link at all so each
  // conversation gets (and keeps) its own.
  const liveConvos = convos.filter(
    (c) => c.source === "Gmail" && !c.is_demo && !removedDuplicateIds.has(c.id)
  );
  const linkCounts = {};
  for (const c of liveConvos) {
    if (c.opportunity_id) linkCounts[c.opportunity_id] = (linkCounts[c.opportunity_id] || 0) + 1;
  }
  const isSharedLink = (convo) =>
    !!(convo.opportunity_id && linkCounts[convo.opportunity_id] > 1);

  const targets = liveConvos.filter(
    (c) =>
      REPROCESSABLE.includes(c.analysis_status) &&
      // Only messages the current classifier rules haven't seen yet — a
      // re-run never re-analyzes (or re-logs) what's already up to date.
      c.analysis_version !== ANALYSIS_VERSION
  );

  for (const convo of targets.slice(0, MAX_REPROCESS)) {
    const threadMsgs = messages
      .filter((m) => m.conversation_id === convo.id)
      .sort((a, b) => new Date(a.received_at || 0).getTime() - new Date(b.received_at || 0).getTime());
    // The latest message in the thread decides the analysis — a follow-up's new
    // intent is what the manager needs to act on now.
    const latest = threadMsgs[threadMsgs.length - 1];
    const body = latest ? latest.body : convo.message;
    // The Inbox preview shows the latest message of the thread — the same one
    // the analysis addresses — never a stale earlier message.
    const preview = { message: body.slice(0, 4000) };

    let analysis;
    try {
      analysis = await analyzeEmail(base44, restaurantName, {
        senderName: convo.customer_name,
        senderEmail: convo.customer_email,
        subject: convo.subject,
        body,
      }, {
        knowledgeContext,
        adminContext: formatAdminContextForPrompt(knowledgeRecord, {
          senderEmail: convo.customer_email,
          subject: convo.subject,
          body,
        }),
        corrections,
        timezone: knowledgeRecord ? knowledgeRecord.timezone : null,
      });
    } catch (e) {
      // Analysis failed — keep the email visible and flagged for manual review
      await base44.entities.Conversation.update(convo.id, {
        analysis_status: "Needs review",
        status: inboxStatus(convo),
      });
      summary.needsReview++;
      continue;
    }
    summary.reprocessed++;

    // A shared (mis-associated) link counts as no link — the conversation
    // will get its own opportunity below.
    const sharedLink = isSharedLink(convo);
    const linkedOpp = !sharedLink && convo.opportunity_id ? await findOpportunity(base44, convo.opportunity_id) : null;
    const untouchedDraft =
      linkedOpp &&
      ["New", "Needs Attention"].includes(linkedOpp.status) &&
      linkedOpp.draft_status === "Draft";
    const classification = analysis.classification || "routine";
    // A manager-edited or already-recorded reply draft is manager-controlled
    // content: re-analysis may update the classification and provenance, but
    // never overwrites the manager's draft.
    const managerDraft = convo.draft_edited || convo.reply_status === "Reply recorded";

    if (classification === "opportunity") {
      const oppType = opportunityTypeFor(analysis.category) || analysis.opportunity_type || "Business inquiry";
      const originalMessage = `Subject: ${convo.subject}\n\n${body}`;
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
        source: "Gmail",
        original_message: originalMessage.slice(0, 8000),
        why_identified:
          [analysis.customer_facts, analysis.relay_assessment, analysis.knowledge_used].filter(Boolean).join(" ") +
          ` Relay flagged this with ${analysis.confidence || "Medium"} confidence.`,
        draft_response: analysis.draft_response || "",
        last_analyzed_at: new Date().toISOString(),
      };

      let oppId = linkedOpp ? linkedOpp.id : "";
      if (linkedOpp && untouchedDraft) {
        await base44.entities.Opportunity.update(linkedOpp.id, fields);
        summary.opportunitiesUpdated++;
      } else if (!linkedOpp) {
        const opp = await base44.entities.Opportunity.create({
          restaurant_id: restaurantId,
          customer_name: convo.customer_name,
          customer_email: convo.customer_email,
          status: "New",
          draft_status: "Draft",
          is_demo: false,
          ...fields,
        });
        opps.push(opp);
        oppId = opp.id;
        if (analysis.draft_response) {
          await base44.entities.Action.create({
            restaurant_id: restaurantId,
            opportunity_id: opp.id,
            type: "Draft response",
            description: `Draft a response to ${convo.customer_name} regarding "${convo.subject}".`,
            status: "Pending Approval",
            requires_approval: true,
          });
        }
        summary.opportunitiesCreated++;
      }

      await base44.entities.Conversation.update(convo.id, {
        opportunity_id: oppId || "",
        ...preview,
        ...conversationUpdatesFor("opportunity", analysis, { preserveManagerDraft: managerDraft }),
        status: inboxStatus(convo),
      });
      // Only a real change earns a history entry — re-running the analysis
      // must not pile up "re-reviewed" events on every pass. The event is
      // scoped to this conversation and its own opportunity.
      if (convo.analysis_status !== "Opportunity") {
        await base44.entities.Activity.create({
          restaurant_id: restaurantId,
          opportunity_id: oppId || "",
          conversation_id: convo.id,
          type: "classification_changed",
          description: `Classification changed from ${convo.analysis_status || "Not analyzed"} to Opportunity — ${analysis.title || convo.subject}`,
        });
      }
    } else {
      // No longer an opportunity: remove the auto-created draft opportunity if
      // nobody has touched it (and drop a stale shared link), then recategorize.
      const dropLink = !!(linkedOpp && untouchedDraft) || sharedLink;
      if (linkedOpp && untouchedDraft) {
        await base44.entities.Action.deleteMany({ opportunity_id: linkedOpp.id });
        await base44.entities.Activity.deleteMany({ opportunity_id: linkedOpp.id });
        await base44.entities.Opportunity.delete(linkedOpp.id);
        summary.opportunitiesRemoved++;
      }
      const outcome = conversationUpdatesFor(classification, analysis, { preserveManagerDraft: managerDraft });
      await base44.entities.Conversation.update(convo.id, {
        ...(dropLink ? { opportunity_id: "" } : {}),
        ...preview,
        ...outcome,
        status: inboxStatus(convo),
      });
      if (classification === "attention") summary.attentionFlagged++;

      // Only a real change earns a history entry — repeated re-analysis with
      // the same result stays silent.
      if (convo.analysis_status && convo.analysis_status !== outcome.analysis_status) {
        await base44.entities.Activity.create({
          restaurant_id: restaurantId,
          opportunity_id: linkedOpp && !untouchedDraft ? linkedOpp.id : "",
          conversation_id: convo.id,
          type: "classification_changed",
          description: `Classification changed from ${convo.analysis_status} to ${outcome.analysis_status}${analysis.intent ? ` — ${analysis.intent}` : ""}: "${convo.subject}"`,
        });
      }
    }
  }

  return summary;
}