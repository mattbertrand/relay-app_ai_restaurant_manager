// Shared duplicate detection used by the Gmail sync. Keeps Relay's "never
// show the customer twice for the same thing" rules in one place.
//
// IMPORTANT: a relationship between two emails can ONLY be established by
// Gmail itself (thread ID / In-Reply-To / References — see threadMatching.ts)
// or by an exact re-send of identical content (below). The same sender —
// even with the same subject — is NEVER enough to link, merge, or attach
// anything: one customer can have many completely separate matters.

export function normalizeText(text) {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeBody(text) {
  return normalizeText(text).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenSet(text) {
  // Keep every token, including single digits ("4", "8") and short words
  // ("pm", "at") — party sizes and times are exactly what distinguishes two
  // different reservations from the same sender; stripping short tokens would
  // make distinct requests look identical.
  return new Set(normalizeBody(text).split(" ").filter(Boolean));
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

// Returns the existing conversation this email is an exact re-send of, or
// null. A duplicate = same live Gmail sender with identical body text, or the
// same subject plus a near-identical (>= 0.85) body, received within the
// window. Distinct content from the same sender (e.g. a different reservation)
// is NOT a duplicate — it is a separate matter.
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

// Records a customer follow-up that arrived INSIDE an existing Gmail thread:
// bumps priority when the new message is urgent, reopens a resolved matter,
// and logs the activity scoped to that conversation and its opportunity.
// Only called for messages Gmail itself attached to the thread — never for a
// separate email from the same sender.
export async function linkFollowup(base44, { restaurantId, opportunity, customerName, priority, conversationId = "" }) {
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
    conversation_id: conversationId,
    type: reopened ? "opportunity_reopened" : "followup_linked",
    description: reopened
      ? `New customer message received — Opportunity reopened: ${opportunity.title}`
      : `Follow-up from ${customerName} linked to existing opportunity: ${opportunity.title}`,
  });
  return reopened;
}