// Shared email analysis used by the Gmail sync, the reprocessing pass, and the test scenarios.
// Keeps Relay's classification rules in one place.

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    classification: { type: "string", enum: ["opportunity", "attention", "administrative", "routine", "spam"] },
    confidence: { type: "string", enum: ["High", "Medium", "Low"] },
    category: {
      type: "string",
      enum: [
        // Customer / revenue
        "catering",
        "private_event",
        "reservation",
        "reservation_issue",
        "customer_service",
        "general_customer_inquiry",
        "high_value_business",
        "partnership",
        // Administrative
        "job_application",
        "vendor",
        "billing_administrative",
        "general_administrative",
        // Routine
        "general_information",
        "automated_notification",
        "non_actionable",
        // Spam / irrelevant
        "spam",
        "newsletter",
        "irrelevant_promotional",
      ],
    },
    intent: {
      type: "string",
      description:
        "Short phrase naming what the sender actually wants, e.g. 'Operating Hours', 'Reservation Request', 'Catering Request', 'Job Application'. Empty only for spam.",
    },
    opportunity_type: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    priority: { type: "string", enum: ["high", "medium", "low"] },
    customer_facts: { type: "string" },
    relay_assessment: { type: "string" },
    why_flagged: { type: "string" },
    knowledge_used: {
      type: "string",
      description:
        "Which verified restaurant facts from the profile apply to this message, in one or two sentences. If the question needs facts the profile does not contain, say so plainly, e.g. 'The profile does not contain Sunday hours.'",
    },
    recommended_action: { type: "string" },
    draft_response: { type: "string" },
    is_followup: { type: "boolean" },
    followup_of: { type: "string" },
    has_value_estimate: { type: "boolean" },
    value_confidence: { type: "string", enum: ["High", "Medium", "Low"] },
    value_basis: { type: "string" },
    estimated_value_min: { type: "number" },
    estimated_value_max: { type: "number" },
  },
  required: ["classification", "confidence", "category", "why_flagged"],
};

const TYPE_BY_CATEGORY = {
  catering: "Catering inquiry",
  private_event: "Private event inquiry",
  reservation: "Reservation inquiry",
  reservation_issue: "Reservation issue",
  customer_service: "Customer service issue",
  high_value_business: "Business inquiry",
  partnership: "Business inquiry",
};

export function opportunityTypeFor(category) {
  return TYPE_BY_CATEGORY[category] || null;
}

export const CLASSIFICATION_LABELS = {
  opportunity: "Opportunity",
  attention: "Attention",
  administrative: "Administrative",
  routine: "Routine",
  spam: "Spam",
};

// How a classified conversation is presented in the Inbox. The Inbox status
// ("What happened with this email?") is intentionally separate from the
// opportunity lifecycle ("What is the status of the customer matter?"):
// a classified message stays New until the manager reviews or handles it.
export function conversationOutcomeFor(classification) {
  if (classification === "attention") return { analysis_status: "Attention", status: "New" };
  if (classification === "administrative") return { analysis_status: "Administrative", status: "New" };
  if (classification === "spam") return { analysis_status: "Spam", status: "New" };
  return { analysis_status: "Routine", status: "New" };
}

// Full conversation updates from an analysis, including what the email
// represents (category) and the sender's intent.
export function conversationUpdatesFor(classification, analysis = {}, options = {}) {
  const updates = { ...conversationOutcomeFor(classification) };
  if (analysis.category) updates.category = analysis.category;
  if (analysis.intent) updates.intent = analysis.intent;
  // Lightweight provenance: why Relay classified the message this way and
  // which verified restaurant facts it used (or that the profile lacks them).
  if (analysis.why_flagged) updates.why_flagged = analysis.why_flagged;
  if (analysis.knowledge_used) updates.knowledge_used = analysis.knowledge_used;
  if (options.preserveManagerDraft) {
    // The manager edited (or already recorded) this draft — it is
    // manager-controlled content and is never silently overwritten.
    return updates;
  }
  // Attention messages carry Relay's suggested reply — with a filled-in
  // restaurant profile it often fully answers the question (e.g. verified
  // Sunday hours). Opportunity drafts live on the Opportunity itself, and
  // routine/spam have none; re-classification clears any stale draft.
  // relay_draft keeps Relay's own generated version so the manager's edit is
  // always distinguishable from the generated one.
  updates.draft_response = classification === "attention" ? analysis.draft_response || "" : "";
  updates.relay_draft = updates.draft_response;
  updates.draft_edited = false;
  return updates;
}

export async function analyzeEmail(base44, restaurantName, email, options = {}) {
  const existingTitles = (options.existingOpportunityTitles || []).filter(Boolean);
  const followupBlock = existingTitles.length
    ? `

THE CUSTOMER'S EXISTING OPEN OPPORTUNITIES (already tracked by the restaurant — never create a second opportunity for the same matter)
${existingTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

If this email is clearly about the same matter as one of the titles above — a follow-up, re-send, duplicate, or continuation of the same request — set is_followup to true and followup_of to the exact matching title. A genuinely different request from the same customer is NOT a follow-up. When in doubt, is_followup is false and followup_of is an empty string.`
    : "";

  const knowledgeBlock = options.knowledgeContext
    ? `

VERIFIED RESTAURANT INFORMATION (entered or confirmed by the restaurant manager — this is the authoritative source for restaurant-specific facts)
${options.knowledgeContext}`
    : `

VERIFIED RESTAURANT INFORMATION
(None provided yet. The restaurant's profile has not been filled in. You must NOT invent any restaurant facts — hours, party-size limits, policies, menu items, catering availability, private-event capacity, none of it. If the customer asks something that needs a restaurant-specific fact, say in knowledge_used that the profile does not contain that information, and draft a response that does not state the fact — e.g. "Let me confirm our Sunday hours for you.")`;

  const corrections = options.corrections || [];
  const correctionsBlock = corrections.length
    ? `

MANAGER CORRECTIONS FOR THIS RESTAURANT (learned from this restaurant manager's own past reviews — follow them when a new message is similar; they apply to this restaurant only)
${corrections.join("\n")}`
    : "";

  const prompt = `You are reviewing one incoming email for "${restaurantName}", a restaurant. Relay's promise to the restaurant is: "Never let another customer opportunity fall through the cracks." Your job is to understand the sender's actual intent and decide how much of the manager's attention it deserves. Do not just match keywords — read the message the way a thoughtful manager would.

THREE SOURCES OF INFORMATION — keep them strictly separate and never blur them:
1. VERIFIED RESTAURANT INFORMATION (below): facts the manager entered or confirmed. This is authoritative for restaurant-specific facts. Never contradict it. When you use one of these facts, say so (e.g. "The restaurant profile states a maximum standard party size of 10.").
2. CUSTOMER-PROVIDED INFORMATION: only what the customer actually wrote (e.g. "The customer is asking about a party of 18.").
3. YOUR INFERENCE: reasoning that combines the two (e.g. "This appears to be a private-event inquiry."). Never present an inference as a verified restaurant fact, and never invent restaurant facts at all.
${knowledgeBlock}${correctionsBlock}${followupBlock}

EMAIL
From: ${email.senderName} <${email.senderEmail}>
Subject: ${email.subject}
Body:
${email.body}

CLASSIFICATION (choose exactly one)
- opportunity: the message represents meaningful purchase intent, a customer-retention issue, or a situation requiring manager intervention:
  * catering requests
  * private event requests (birthday, wedding, anniversary, corporate event, buyout, private party)
  * large-party reservation requests
  * clear reservation requests — ANY clear intent to make or ask about making a reservation, even if details are missing ("Can I book a table for 8 Sunday at 6?" is a Reservation Opportunity; so is "I need to make a reservation.")
  * reservation problems, failed booking attempts, cancellations ("I need to cancel my reservation"), issues with an existing reservation
  * customer complaints about a previous visit
  * billing disputes, including gratuity or unexpected-charge complaints
  * significant service issues
  * other important customer requests
  * business/partnership inquiries
- attention: real customer intent worth a manager's glance, but NOT a revenue opportunity. These stay visible in the Inbox but never become Opportunities:
  * simple informational questions a real customer asked — e.g. "Hi, are you open this Sunday?" is a legitimate customer inquiry (recognize the intent; if the profile contains Sunday hours you may draft the answer with them)
  * questions with typos, informal wording, or unusual phrasing — judge the sender's intent, never their spelling: "What are your oping hours on Tuesday?" is an operating-hours question, not a test or junk mail
  * menu, dietary, or allergen questions
  * questions about loyalty programs or gift cards
  * asking for information about private dining rather than requesting to book
  * special requests
  * thank-you notes worth seeing (but a bare thank-you with no question is routine)
- administrative: real but non-customer correspondence that does not represent a customer or revenue matter:
  * job applications — a job application, resume/CV, application follow-up, interview availability, candidate follow-up, or employment inquiry is ALWAYS Administrative → Job Application, never a customer opportunity, even when the person sounds eager
  * employment inquiries
  * vendor and general administrative messages
  * billing/account administrative mail
- routine: ordinary low-priority messages that do not require manager intervention:
  * automated notifications (confirmations, receipts, calendar invites)
  * no-actionable-intent messages ("Test")
  * a bare thank-you with no question
- spam: obvious spam, newsletters, unrelated promotional email, marketing blasts, or anything clearly irrelevant.

CATEGORY (choose exactly one)
- Customer / revenue (when classification is opportunity): catering, private_event, reservation, reservation_issue, customer_service, high_value_business, partnership
- general_customer_inquiry: a real customer asked a question (classification attention, or opportunity only in the rare case a question itself shows purchase intent worth tracking)
- Administrative (classification administrative): job_application, vendor, billing_administrative, general_administrative
- Routine (classification routine): general_information, automated_notification, non_actionable
- Spam (classification spam): spam, newsletter, irrelevant_promotional

INTENT: name what the sender actually wants in 2-4 words — "Operating Hours", "Reservation Request", "Catering Request", "Job Application", "Reservation Cancellation", "Gluten-Free Options".

HOW TO DECIDE
1. Read the actual intent: Is the sender a real potential customer? Are they asking to purchase, book, reserve, or schedule? Reporting a problem? Or asking a question, applying for a job, or sending automated mail? Surface meaningful customer intent — but do NOT maximize opportunities. Ordinary questions and administrative mail must not become opportunities.
2. Use the VERIFIED RESTAURANT INFORMATION when it applies. Examples:
   - Customer asks "Can I reserve a table for 18 people?" and the profile states a maximum standard party size of 10 → this is still a Reservation Opportunity; in why_flagged explain that the customer requests a party of 18 while the restaurant profile states a maximum standard party size of 10. If the profile describes a large-party process, use it in the draft; if it does not, do NOT invent what the restaurant will do instead — ask the customer to contact the restaurant directly or say the team will follow up.
   - Customer asks "We're looking for a private dinner for 45 people" and the profile says private events are available up to 60 → strong private event opportunity.
   - Customer asks "Are you open this Sunday?" and the profile contains Sunday hours → classification attention, category general_customer_inquiry, intent "Operating Hours", and a draft that answers with the verified hours. If the profile does NOT contain Sunday hours, still classify it attention/general_customer_inquiry, but never invent hours — draft something like "Let me confirm our Sunday hours for you."
   - Customer asks "Can we come at 10 AM on Sunday?" and the profile lists Sunday hours of 12:00 PM–9:00 PM → the request conflicts with the verified hours. Say so in knowledge_used and why_flagged, and draft a response that states the verified Sunday hours instead of implying 10 AM works. When the profile configures an alternative (a large-party or private-event process), point to it; when it does not, do not invent one.
3. Job applications and their follow-ups (resume re-sent, "just following up on my application") are the SAME administrative matter: classification administrative, category job_application, and is_followup true with followup_of naming the matter (e.g. "Server position application"). Never create a customer opportunity for employment messages.
4. is_followup means this message continues a matter that already exists (an open opportunity, or a non-opportunity matter like a job application from the same sender). Two emails from the same person are NOT automatically related — a genuinely new, unrelated request is not a follow-up.
5. confidence describes your confidence in the CLASSIFICATION itself: High when the intent is unmistakable, Medium when fairly clear, Low when genuinely uncertain.
6. Value estimate: ONLY for catering, private events, large parties (about 10+ guests), or when the customer states an explicit monetary amount. Assumptions: catering $18-$30 per person; private events and large-party dining $50-$75 per person. If the customer states a spending amount, use it with High confidence. If only a guest count is known, use Medium confidence. Otherwise has_value_estimate is false — never invent a value, and never estimate a value for a standard table reservation, even when the party size is known. value_basis is a short plain-English calculation like "80 guests × $18–$30 per person".
7. customer_facts: ONLY what the customer actually wrote, in one or two factual sentences. Never include your own assumptions.
8. relay_assessment: your assessment of why it matters, framed as an assessment ("May represent a significant catering opportunity."), never as something the customer said. Empty string when classification is routine, administrative, or spam.
9. why_flagged: 1-2 factual sentences combining what the customer asked for, why it matters, and — when one applies — the verified restaurant fact it relates to (e.g. "The restaurant profile states a maximum standard party size of 10."). Never mention AI, models, algorithms, or technology.
10. knowledge_used: the verified facts from the profile that apply to this message, or a plain statement that the profile does not contain the needed information. Never list facts you inferred or invented.
11. recommended_action: one specific action tied to the actual message. Empty string when classification is routine or spam.
12. draft_response: a short, professional reply from the restaurant to this customer, signed with "${restaurantName}". Write it when classification is opportunity or attention. Use ONLY facts from the customer's message and the VERIFIED RESTAURANT INFORMATION — you may state verified hours, policies, and limits exactly as the profile gives them. Never invent prices, menu items, availability, discounts, catering packages, policies, or confirm a booking. If the profile lacks the fact the customer needs, do not state it — offer to confirm instead ("Let me confirm our Sunday hours for you") or ask for the missing details (event type, date, guest count, budget). If the customer's request conflicts with a verified fact (a time outside verified hours, a party larger than the standard maximum), state the verified fact and address the conflict directly rather than ignoring it — and never imply the request is accepted. Never claim an action was taken that Relay cannot take — no email was sent, no availability was checked, no reservation was confirmed, modified, or cancelled, and no third-party system was consulted; offer to review and follow up instead. Empty string when classification is routine, administrative, or spam.
13. priority: high for customer_service, reservation_issue, time-sensitive requests, and large or high-value opportunities; medium for clear opportunities with specifics; low otherwise.

Return JSON only.`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: ANALYSIS_SCHEMA,
  });
  return result;
}