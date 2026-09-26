// Shared duplicate detection and follow-up linking used by the Gmail sync and
// the reprocessing pass. Keeps Relay's "never show the customer twice for the
// same thing" rules in one place.

export function normalizeText(text) {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeBody(text) {
  return normalizeText(text).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenSet(text) {
  return new Set(normalizeBody(text).split(" ").filter((t) => t.length > 2));
}

// Jaccard similarity on body tokens, 0-1
export function bodySimilarity(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  return shared / (A.size + B.size - shared);
}

const DUPLICATE_WINDOW_DAYS = 45;
const receivedMs = (c) =>
  new Date(c.received_at || c.created_date || 0).getTime();

// Returns the existing conversation this email duplicates, or null.
// A duplicate = same live Gmail sender with identical body text, or the same
// subject plus a near-identical body, received within the window. Distinct
// content from the same sender (e.g. a different question) is NOT a duplicate.
export function findDuplicateConversation(convos, { senderEmail, subject, body }) {
  const email = (senderEmail || "").toLowerCase();
  if (!email) return null;
  const cutoff = Date.now() - DUPLICATE_WINDOW_DAYS * 24 * 3600 * 1000;
  let best = null;
  for (const c of convos) {
    if (c.is_demo || c.source !== "Gmail") continue;
    if ((c.customer_email || "").toLowerCase() !== email) continue;
    if (receivedMs(c) < cutoff) continue;
    const sameBody = normalizeBody(c.message) === normalizeBody(body);
    const sameSubject = normalizeText(c.subject) === normalizeText(subject);
    if (sameBody || (sameSubject && bodySimilarity(c.message, body) >= 0.85)) {
      if (!best || receivedMs(c) < receivedMs(best)) best = c;
    }
  }
  return best;
}

// Statuses in which an opportunity can receive a linked follow-up. Resolved
// matters are included on purpose: a new customer message about the same
// matter reopens them (handled by linkFollowup).
const LINKABLE_OPP_STATUSES = [
  "New",
  "In Progress",
  "Resolved",
  "Needs Attention",
  "Needs Review",
  "Needs Response",
];

// Non-demo opportunities already tracked for this sender (minus excludeId)
export function opportunityTitlesFor(opps, senderEmail, excludeId = "") {
  const email = (senderEmail || "").toLowerCase();
  if (!email) return [];
  return opps
    .filter((o) => !o.is_demo && o.id !== excludeId)
    .filter((o) => (o.customer_email || "").toLowerCase() === email)
    .filter((o) => LINKABLE_OPP_STATUSES.includes(o.status))
    .map((o) => o.title);
}

export function findOpportunityByTitle(opps, senderEmail, title, excludeId = "") {
  const wanted = (title || "").trim();
  if (!wanted) return null;
  return (
    opps.find(
      (o) =>
        o.id !== excludeId &&
        !o.is_demo &&
        (o.customer_email || "").toLowerCase() === (senderEmail || "").toLowerCase() &&
        o.title === wanted &&
        LINKABLE_OPP_STATUSES.includes(o.status)
    ) || null
  );
}

// Finds an existing conversation from the same live sender carrying the same
// category — used to merge related follow-ups (e.g. a job application
// follow-up arriving as a brand-new thread) into the conversation they belong
// to, instead of showing them as unrelated messages. Gmail thread/reply
// relationships are matched earlier in the sync; this covers the rest.
export function findRelatedConversation(convos, { senderEmail, category, excludeId = "" }) {
  const email = (senderEmail || "").toLowerCase();
  if (!email || !category) return null;
  return (
    convos.find(
      (c) =>
        c.id !== excludeId &&
        !c.is_demo &&
        c.source === "Gmail" &&
        (c.customer_email || "").toLowerCase() === email &&
        c.category === category
    ) || null
  );
}

// Moves a follow-up conversation's messages into the conversation it belongs
// to and removes the duplicate record, so related messages read as one
// continuous conversation in the Inbox.
export async function mergeConversations(base44, { restaurantId, fromConvo, toConvo, messages, description }) {
  const fromMsgs = (messages || []).filter((m) => m.conversation_id === fromConvo.id);
  if (fromMsgs.length) {
    await base44.entities.ConversationMessage.bulkUpdate(
      fromMsgs.map((m) => ({ id: m.id, conversation_id: toConvo.id }))
    );
  }
  await base44.entities.Conversation.update(toConvo.id, {
    message: fromConvo.message || toConvo.message,
    status: "New",
  });
  await base44.entities.Conversation.delete(fromConvo.id);
  await base44.entities.Activity.create({
    restaurant_id: restaurantId,
    opportunity_id: toConvo.opportunity_id || "",
    type: "email_received",
    description,
  });
}

// Links a follow-up message to an existing opportunity: bumps priority when the
// new message is urgent, reopens a resolved matter, and records the activity.
export async function linkFollowup(base44, { restaurantId, opportunity, customerName, priority }) {
  const updates = {};
  let reopened = false;
  if (opportunity.status === "Resolved") {
    updates.status = "In Progress";
    reopened = true;
  }
  if (priority === "high" && opportunity.priority !== "high") {
    updates.priority = "high";
  }
  if (Object.keys(updates).length) {
    await base44.entities.Opportunity.update(opportunity.id, updates);
  }
  await base44.entities.Activity.create({
    restaurant_id: restaurantId,
    opportunity_id: opportunity.id,
    type: reopened ? "opportunity_reopened" : "followup_linked",
    description: reopened
      ? `New customer message received — Opportunity reopened: ${opportunity.title}`
      : `Follow-up from ${customerName} linked to existing opportunity: ${opportunity.title}`,
  });
  return reopened;
}