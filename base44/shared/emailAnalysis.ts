// Shared email analysis used by the Gmail sync, the reprocessing pass, and the test scenarios.
// Keeps Relay's classification rules in one place.

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    classification: { type: "string", enum: ["opportunity", "attention", "routine", "spam"] },
    confidence: { type: "string", enum: ["High", "Medium", "Low"] },
    category: {
      type: "string",
      enum: [
        "catering_inquiry",
        "private_event_inquiry",
        "reservation_inquiry",
        "reservation_issue",
        "customer_service_issue",
        "high_value_business_inquiry",
        "general_inquiry",
        "irrelevant",
      ],
    },
    opportunity_type: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    priority: { type: "string", enum: ["high", "medium", "low"] },
    customer_facts: { type: "string" },
    relay_assessment: { type: "string" },
    why_flagged: { type: "string" },
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
  catering_inquiry: "Catering inquiry",
  private_event_inquiry: "Private event inquiry",
  reservation_inquiry: "Reservation inquiry",
  reservation_issue: "Reservation issue",
  customer_service_issue: "Customer service issue",
  high_value_business_inquiry: "Business inquiry",
};

export function opportunityTypeFor(category) {
  return TYPE_BY_CATEGORY[category] || null;
}

export const CLASSIFICATION_LABELS = {
  opportunity: "Opportunity",
  attention: "Attention",
  routine: "Routine",
  spam: "Spam",
};

// How a classified conversation is presented in the Inbox
export function conversationOutcomeFor(classification) {
  if (classification === "attention") return { analysis_status: "Attention", status: "Needs Attention" };
  if (classification === "spam") return { analysis_status: "Spam", status: "Closed" };
  return { analysis_status: "Routine", status: "New" };
}

export async function analyzeEmail(base44, restaurantName, email, options = {}) {
  const existingTitles = (options.existingOpportunityTitles || []).filter(Boolean);
  const followupBlock = existingTitles.length
    ? `

THE CUSTOMER'S EXISTING OPEN OPPORTUNITIES (already tracked by the restaurant — never create a second opportunity for the same matter)
${existingTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

If this email is clearly about the same matter as one of the titles above — a follow-up, re-send, duplicate, or continuation of the same request — set is_followup to true and followup_of to the exact matching title. A genuinely different request from the same customer is NOT a follow-up. When in doubt, is_followup is false and followup_of is an empty string.`
    : "";
  const prompt = `You are reviewing one incoming email for "${restaurantName}", a restaurant. Relay's promise to the restaurant is: "Never let another customer opportunity fall through the cracks." Your job is to understand the sender's actual intent and decide how much of the manager's attention it deserves. Do not just match keywords — read the message the way a thoughtful manager would.

EMAIL
From: ${email.senderName} <${email.senderEmail}>
Subject: ${email.subject}
Body:
${email.body}
${followupBlock}

CLASSIFICATION (choose exactly one)
- opportunity: the message represents a meaningful potential revenue opportunity, a customer-retention issue, or a situation requiring manager intervention. This includes:
  * catering inquiries
  * private event inquiries (birthday, wedding, anniversary, corporate event, buyout, private party)
  * large-party inquiries
  * reservation requests — ANY clear intent to make or ask about making a reservation, even if details like party size or date are missing, and even for small parties
  * reservation problems, failed booking attempts, or issues with an existing reservation
  * customer complaints about a previous visit
  * billing disputes, including gratuity or unexpected-charge complaints
  * significant service issues
  * other important customer requests
  * business/partnership inquiries
- attention: not a major opportunity, but contains customer intent a restaurant manager may reasonably want to see or respond to:
  * questions about loyalty programs
  * gift card questions
  * menu or dietary questions
  * special requests
  * questions about private dining (asking for information rather than requesting to book)
  * questions that could lead to a future visit or purchase
- routine: ordinary low-priority messages that do not require manager intervention:
  * simple general-information questions (e.g. "are you open Sunday?")
  * job applications
  * automated notifications (confirmations, receipts, calendar invites)
  * vendor and general administrative messages
  * ordinary non-actionable correspondence
- spam: obvious spam, newsletters, unrelated promotional email, marketing blasts, or anything clearly irrelevant.

CATEGORY (choose exactly one)
- catering_inquiry / private_event_inquiry / reservation_inquiry / reservation_issue / customer_service_issue / high_value_business_inquiry: use the matching one when classification is opportunity.
- general_inquiry: use when classification is attention or routine.
- irrelevant: use when classification is spam.

HOW TO DECIDE
1. Consider the actual intent expressed in the message: Is the sender a real potential customer? Are they asking to purchase, book, reserve, or schedule something? Are they reporting a problem? Are they asking for information that could lead to a visit or purchase? Is the request time-sensitive? Is there a meaningful risk of losing the customer if nobody responds? Or is it simply informational, automated, administrative, or irrelevant?
2. Favor surfacing important customer intent over silently treating it as an ordinary message — the cost of missing a real opportunity is higher than the cost of an extra glance. When genuinely torn between attention and routine, choose attention.
3. But do NOT maximize opportunities: routine questions, automated mail, and job applications must stay out of the manager's priority workflow. Do not turn every customer question into an opportunity.
4. Do not keyword-match blindly. An email that merely contains the word "reservation" but is an automated reservation confirmation or a third-party notification is routine or spam, not an opportunity. An email that merely mentions food, dinner, or a menu without any request or problem is not an opportunity.
5. A customer attempting to make a reservation is demonstrating meaningful purchase intent even if reservation details are missing — classify reservation requests as opportunity with category reservation_inquiry, and failed booking attempts or reservation problems as reservation_issue.
6. confidence describes your confidence in the CLASSIFICATION itself, not any dollar value: High when the intent is unmistakable, Medium when fairly clear, Low when genuinely uncertain.
7. Value estimate: ONLY for catering, private events, large parties (about 10+ guests), or when the customer states an explicit monetary amount. Assumptions: catering $18-$30 per person; private events and large-party dining $50-$75 per person. If the customer states a spending amount, use it with High confidence. If only a guest count is known, use Medium confidence. Otherwise has_value_estimate is false — never invent a value, and never estimate a value for a standard table reservation (e.g. a party of 3 booking a table), even when the party size is known. value_basis is a short plain-English calculation like "80 guests × $18–$30 per person".
8. customer_facts: ONLY what the customer actually wrote (guest counts, dates, requests), in one or two factual sentences. Never include your own assumptions.
9. relay_assessment: your assessment of why it matters, framed as an assessment ("May represent a significant catering opportunity."), never as something the customer said. Empty string when classification is routine or spam.
10. why_flagged: 1-2 factual sentences combining what the customer asked for and why it matters. Never mention AI, models, algorithms, or technology.
11. recommended_action: one specific action tied to the actual message (e.g. "Review and respond to reservation request"). Empty string when classification is routine or spam.
12. draft_response: a short, professional reply from the restaurant to this customer, signed with "${restaurantName}". Use ONLY facts from the customer's message — never invent prices, menu items, availability, discounts, catering packages, policies, or confirm a booking. If more details are needed, politely ask for them (event type, date, guest count, budget). Write it when classification is opportunity or attention. Empty string when classification is routine or spam.
13. priority: high for customer_service_issue, reservation_issue, time-sensitive requests, and large or high-value opportunities; medium for clear opportunities with specifics; low otherwise.

Return JSON only.`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: ANALYSIS_SCHEMA,
  });
  return result;
}