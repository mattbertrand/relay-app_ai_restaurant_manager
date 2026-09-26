import {
  analyzeEmail,
  opportunityTypeFor,
  CLASSIFICATION_LABELS,
  conversationOutcomeFor,
} from "./emailAnalysis.ts";
import {
  findOpportunityByTitle,
  opportunityTitlesFor,
  linkFollowup,
} from "./dedupe.ts";

const MAX_REPROCESS = 20;
const REPROCESSABLE = ["Opportunity", "No opportunity", "Attention", "Routine", "Spam", "Needs review"];

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
// has already reviewed, edited, or approved is left alone.
export async function reprocessConversations({ base44, restaurantId, restaurantName, convos, messages }) {
  const opps = await base44.entities.Opportunity.filter({ restaurant_id: restaurantId }, null, 500);
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
  };

  const targets = convos.filter(
    (c) => c.source === "Gmail" && !c.is_demo && REPROCESSABLE.includes(c.analysis_status)
  );

  for (const convo of targets.slice(0, MAX_REPROCESS)) {
    const firstMsg = messages.find((m) => m.conversation_id === convo.id);
    const body = firstMsg ? firstMsg.body : convo.message;

    let analysis;
    try {
      analysis = await analyzeEmail(base44, restaurantName, {
        senderName: convo.customer_name,
        senderEmail: convo.customer_email,
        subject: convo.subject,
        body,
      }, {
        existingOpportunityTitles: opportunityTitlesFor(opps, convo.customer_email, convo.opportunity_id),
      });
    } catch (e) {
      // Analysis failed — keep the email visible and flagged for manual review
      await base44.entities.Conversation.update(convo.id, {
        analysis_status: "Needs review",
        status: "Needs Attention",
      });
      summary.needsReview++;
      continue;
    }
    summary.reprocessed++;

    const linkedOpp = convo.opportunity_id ? await findOpportunity(base44, convo.opportunity_id) : null;
    const untouchedDraft =
      linkedOpp &&
      ["New", "Needs Attention"].includes(linkedOpp.status) &&
      linkedOpp.draft_status === "Draft";
    const classification = analysis.classification || "routine";

    if (classification === "opportunity") {
      // A follow-up about a matter already tracked: link it, don't duplicate it.
      // The linked opportunity itself may be the resolved matter the customer
      // is following up on — reopening it keeps the thread continuous.
      const resolvedSelf =
        linkedOpp && linkedOpp.status === "Resolved" && analysis.followup_of === linkedOpp.title
          ? linkedOpp
          : null;
      const relatedOpp =
        analysis.is_followup && (!linkedOpp || untouchedDraft)
          ? findOpportunityByTitle(opps, convo.customer_email, analysis.followup_of, convo.opportunity_id)
          : null;
      const targetOpp = resolvedSelf || relatedOpp;
      if (targetOpp) {
        if (linkedOpp && untouchedDraft && linkedOpp.id !== targetOpp.id) {
          await base44.entities.Action.deleteMany({ opportunity_id: linkedOpp.id });
          await base44.entities.Activity.deleteMany({ opportunity_id: linkedOpp.id });
          await base44.entities.Opportunity.delete(linkedOpp.id);
          summary.opportunitiesRemoved++;
        }
        const reopened = await linkFollowup(base44, {
          restaurantId,
          opportunity: targetOpp,
          customerName: convo.customer_name,
          priority: analysis.priority,
        });
        await base44.entities.Conversation.update(convo.id, {
          opportunity_id: targetOpp.id,
          status: "Opportunity",
          analysis_status: "Opportunity",
        });
        summary.followupsLinked++;
        if (reopened) summary.reopened++;
        continue;
      }
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
          [analysis.customer_facts, analysis.relay_assessment].filter(Boolean).join(" ") +
          ` Relay flagged this with ${analysis.confidence || "Medium"} confidence.`,
        draft_response: analysis.draft_response || "",
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
        ...(oppId ? { opportunity_id: oppId } : {}),
        status: "Opportunity",
        analysis_status: "Opportunity",
      });
      await base44.entities.Activity.create({
        restaurant_id: restaurantId,
        opportunity_id: oppId,
        type: "message_reviewed",
        description: `Message re-reviewed and confirmed as an opportunity: ${analysis.title || convo.subject}`,
      });
    } else {
      // No longer an opportunity: remove the auto-created draft opportunity if
      // nobody has touched it, and recategorize the conversation.
      if (linkedOpp && untouchedDraft) {
        await base44.entities.Action.deleteMany({ opportunity_id: linkedOpp.id });
        await base44.entities.Activity.deleteMany({ opportunity_id: linkedOpp.id });
        await base44.entities.Opportunity.delete(linkedOpp.id);
        await base44.entities.Conversation.update(convo.id, { opportunity_id: "" });
        summary.opportunitiesRemoved++;
      }
      const outcome = conversationOutcomeFor(classification);
      await base44.entities.Conversation.update(convo.id, outcome);
      if (classification === "attention") summary.attentionFlagged++;
      await base44.entities.Activity.create({
        restaurant_id: restaurantId,
        opportunity_id: linkedOpp && !untouchedDraft ? linkedOpp.id : "",
        type: "message_reviewed",
        description: `Message from ${convo.customer_name} re-reviewed and classified as ${CLASSIFICATION_LABELS[classification] || classification}: "${convo.subject}"`,
      });
    }
  }

  return summary;
}