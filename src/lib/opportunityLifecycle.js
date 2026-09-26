// Canonical opportunity lifecycle for Relay: New → In Progress → Resolved
// (plus Dismissed, which is outside the active workflow). Legacy statuses from
// earlier versions are mapped so existing records read correctly.

export const NEW_STATUSES = ["New", "Needs Attention", "Needs Review", "Needs Response"];
export const RESOLVED_STATUSES = ["Resolved", "Completed"];

export function lifecycleStatus(status) {
  if (RESOLVED_STATUSES.includes(status)) return "Resolved";
  if (status === "In Progress") return "In Progress";
  if (status === "Dismissed") return "Dismissed";
  return "New";
}

// What the manager should do next — never claims the customer received
// anything, since Relay does not send external messages.
export function nextStepFor(opp) {
  const stage = lifecycleStatus(opp.status);
  if (stage === "Resolved") return "No further action required.";
  if (stage === "Dismissed") return "No further action required — this item was dismissed.";
  if (stage === "New") {
    return "Review the customer request and prepare a response.";
  }
  // In Progress
  if (opp.draft_status === "Approved") {
    return "Customer response still needs to be handled through the restaurant's communication channel — Relay has not sent anything on your behalf.";
  }
  if (opp.draft_status === "Edited") {
    return "Finish reviewing the edited draft, then approve it to record the response.";
  }
  return (
    opp.recommended_action ||
    "Follow up with the customer and confirm the matter has been addressed."
  );
}