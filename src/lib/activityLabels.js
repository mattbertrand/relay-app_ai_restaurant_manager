// Human-readable labels for the Activity History. Technical/internal events
// are hidden from the manager's view so the history tells a clean story.

export const ACTIVITY_LABELS = {
  email_received: "Customer email received",
  email_imported: "Email imported (initial history)",
  opportunity_identified: "Opportunity identified",
  draft_prepared: "Draft response created",
  draft_edited: "Response edited",
  response_approved: "Response approved",
  opportunity_reviewed: "Opportunity reviewed",
  opportunity_resolved: "Opportunity marked Resolved",
  opportunity_reopened: "Opportunity reopened",
  opportunity_dismissed: "Opportunity dismissed",
  followup_linked: "Customer follow-up received",
  classification_changed: "Classification changed",
  reanalyzed: "Re-analyzed with current knowledge",
  message_reviewed: "Message re-reviewed",
  reply_recorded: "Reply recorded",
  moved_to_new: "Moved back to New",
  status_changed: "Status changed",
  archived: "Archived",
  review_received: "Review received",
  review_analyzed: "Review analyzed",
  review_flagged: "Relay flagged this review",
  review_reviewed: "Manager picked this up",
  review_resolved: "Review marked Resolved",
  review_reopened: "Review reopened",
  review_owner_response: "Owner response detected",
  review_response_published: "Response published",
  review_response_publish_failed: "Response publication failed",
  task_created: "Follow-up task created",
  task_updated: "Follow-up task updated",
  task_completed: "Follow-up task completed",
  task_reopened: "Follow-up task reopened",
  task_snoozed: "Follow-up snoozed",
  email_draft_created: "Email draft created",
  email_draft_edited: "Email draft edited",
  email_recorded_sent: "Email recorded as sent in Relay",
  conversation_workflow_updated: "Email workflow updated",
};

// Internal bookkeeping that never belongs in the manager-facing history.
export const HIDDEN_ACTIVITY_TYPES = ["email_merged", "status_update", "sync", "message_reviewed", "review_content_expired", "review_sync"];

export function isUserFacingActivity(activity) {
  return activity && !HIDDEN_ACTIVITY_TYPES.includes(activity.type);
}

export function activityLabel(activity) {
  return (activity && ACTIVITY_LABELS[activity.type]) || "Activity";
}