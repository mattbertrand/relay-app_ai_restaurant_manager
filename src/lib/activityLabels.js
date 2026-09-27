// Human-readable labels for the Activity History. Technical/internal events
// are hidden from the manager's view so the history tells a clean story.

export const ACTIVITY_LABELS = {
  email_received: "Customer email received",
  opportunity_identified: "Opportunity identified",
  draft_prepared: "Draft response created",
  draft_edited: "Response edited",
  response_approved: "Response approved",
  opportunity_reviewed: "Opportunity reviewed",
  opportunity_resolved: "Opportunity marked Resolved",
  opportunity_reopened: "Opportunity reopened",
  opportunity_dismissed: "Opportunity dismissed",
  followup_linked: "Customer follow-up received",
  message_reviewed: "Message re-reviewed",
  reply_recorded: "Reply recorded",
  moved_to_new: "Moved back to New",
  archived: "Archived",
};

// Internal bookkeeping that never belongs in the manager-facing history.
export const HIDDEN_ACTIVITY_TYPES = ["email_merged", "status_update", "sync"];

export function isUserFacingActivity(activity) {
  return activity && !HIDDEN_ACTIVITY_TYPES.includes(activity.type);
}

export function activityLabel(activity) {
  return (activity && ACTIVITY_LABELS[activity.type]) || "Activity";
}