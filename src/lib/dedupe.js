// Frontend helpers for grouping near-duplicate customer messages in list views.

export function conversationGroupKey(convo) {
  if (!convo || !convo.customer_email) return null;
  return `${convo.customer_email.toLowerCase()}|${(convo.subject || "").trim().toLowerCase()}`;
}

// The copy to lead a group with: strongest classification first, then most recent
export function pickPrimaryConversation(group) {
  const score = (c) =>
    c.opportunity_id ? 3 : c.analysis_status === "Attention" ? 2 : 1;
  return [...group].sort(
    (a, b) =>
      score(b) - score(a) ||
      new Date(b.received_at || b.created_date) - new Date(a.received_at || a.created_date)
  )[0];
}