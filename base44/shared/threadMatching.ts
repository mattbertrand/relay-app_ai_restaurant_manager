// Pure Gmail thread-identity matching — the ONLY signals that connect two
// emails into one conversation, in priority order:
//   1. Gmail thread ID
//   2. RFC In-Reply-To / References headers
// Sender, subject, or wording similarity is deliberately NOT a relationship
// signal: the same customer can have many separate matters, so nothing here
// ever looks at who sent the message.
// Callers pass only live Gmail (non-demo) conversations.

export function normalizeRfcId(value) {
  return (value || "").trim().toLowerCase();
}

// Returns the existing conversation this incoming message belongs to, or null
// when Gmail gives no relationship (a genuinely new matter).
export function matchExistingConversation({
  convos,
  rfcToConversationId,
  threadId,
  inReplyTo,
  references,
}) {
  const index = rfcToConversationId || {};
  // 1. Gmail explicitly filed this message under an existing thread.
  if (threadId) {
    const byThread = convos.find((c) => c.gmail_thread_id === threadId);
    if (byThread) return byThread;
  }
  // 2. The message answers another (In-Reply-To / References), even when Gmail
  // assigned it a fresh thread ID.
  const refIds = [inReplyTo, ...(references || [])]
    .map(normalizeRfcId)
    .filter(Boolean);
  for (const rid of refIds) {
    const convoId = index[rid];
    if (!convoId) continue;
    const target = convos.find((c) => c.id === convoId);
    if (target) return target;
  }
  return null;
}