import { base44 } from "@/api/base44Client";

// Email workflow status — separate from the response state. An email's
// workflow follows its linked Opportunity (New → In Progress → Resolved);
// recording a response never changes the workflow, and resolving the workflow
// never erases the response.

export const WORKFLOW_FILTERS = ["All", "New", "In Progress", "Resolved", "Archived"];

export const RESPONSE_FILTERS = ["All responses", "Needs Response", "Response Recorded"];

// The workflow state an email shows — backfills the field for records that
// predate it.
export function effectiveWorkflow(convo) {
  if (!convo) return "New";
  if (convo.workflow_status) return convo.workflow_status;
  return convo.status === "Archived" ? "Archived" : "New";
}

// The response state an email shows — "Needs Response" or "Response Recorded".
export function effectiveResponse(convo) {
  return convo.status === "Reply recorded" || convo.reply_status === "Reply recorded"
    ? "Response Recorded"
    : "Needs Response";
}

// Workflow status of the linked opportunity, mapped for the email.
export function workflowForOpportunity(opp) {
  if (!opp) return null;
  if (opp.status === "Resolved") return "Resolved";
  if (opp.status === "Dismissed") return "Archived";
  if (opp.status === "In Progress") return "In Progress";
  return "New";
}

// Pushes the opportunity's workflow state onto every email linked to it,
// and records the workflow change in each email's Activity History. Returns
// how many emails changed (0 is fine — already in sync).
export async function syncConversationWorkflow(opportunityId, stage, restaurantId, opportunityTitle) {
  if (!opportunityId || !restaurantId) return 0;
  const next = workflowForOpportunity({ status: stage });
  if (!next) return 0;
  try {
    const page = await base44.entities.Conversation.filter(
      { restaurant_id: restaurantId, opportunity_id: opportunityId },
      { limit: 20 }
    );
    const convos = (Array.isArray(page) ? page : page.items || []).filter(
      (c) => effectiveWorkflow(c) !== next
    );
    if (convos.length) {
      await base44.entities.Conversation.bulkUpdate(
        convos.map((c) => ({ id: c.id, workflow_status: next }))
      );
      await base44.entities.Activity.bulkCreate(
        convos.map((c) => ({
          restaurant_id: restaurantId,
          conversation_id: c.id,
          opportunity_id: opportunityId,
          type: "conversation_workflow_updated",
          description: `Email workflow updated to ${next}${opportunityTitle ? ` — ${opportunityTitle}` : ""}. Recording a response never resolves the workflow, and this change doesn't erase the recorded response.`,
          is_demo: !!c.is_demo,
        }))
      );
    }
    return convos.length;
  } catch (err) {
    console.error(err);
    return 0;
  }
}