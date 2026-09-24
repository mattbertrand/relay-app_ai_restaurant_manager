// Shared email analysis used by the Gmail sync and the test scenarios.
// Keeps Relay's classification rules in one place.

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    is_opportunity: { type: "boolean" },
    category: {
      type: "string",
      enum: [
        "catering_inquiry",
        "private_event_inquiry",
        "reservation_inquiry",
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
    has_value_estimate: { type: "boolean" },
    value_confidence: { type: "string", enum: ["High", "Medium", "Low"] },
    value_basis: { type: "string" },
    estimated_value_min: { type: "number" },
    estimated_value_max: { type: "number" },
  },
  required: ["is_opportunity", "category", "why_flagged"],
};

const TYPE_BY_CATEGORY = {
  catering_inquiry: "Catering inquiry",
  private_event_inquiry: "Private event inquiry",
  reservation_inquiry: "Reservation inquiry",
  customer_service_issue: "Customer service issue",
  high_value_business_inquiry: "Business inquiry",
};

export function opportunityTypeFor(category) {
  return TYPE_BY_CATEGORY[category] || null;
}

export async function analyzeEmail(base44, restaurantName, email) {
  const prompt = `You are reviewing one incoming email for "${restaurantName}", a restaurant. Decide whether it represents a meaningful business opportunity that the restaurant manager should review.

EMAIL
From: ${email.senderName} <${email.senderEmail}>
Subject: ${email.subject}
Body:
${email.body}

CATEGORY (choose exactly one)
- catering_inquiry: catering requests (e.g. "do you cater", "food for 50 people", corporate event catering)
- private_event_inquiry: birthday, wedding, anniversary, corporate event, private party, buyout or private dining requests
- reservation_inquiry: reservation questions involving large parties, private dining, or a special occasion
- customer_service_issue: complaints, problems with a previous visit, refund requests, requests to speak with a manager
- high_value_business_inquiry: partnership, corporate relationship, large recurring order, event collaboration, or other significant business inquiry
- general_inquiry: ordinary questions that are NOT meaningful opportunities
- irrelevant: newsletters, marketing, automated notifications, spam, or anything not from a real individual customer

RULES
1. Precision over recall. When unsure, is_opportunity is false. An ordinary question like "are you open Sunday?" is general_inquiry and NOT an opportunity. Merely mentioning food, dinner, menu, or a reservation for a small group is NOT an opportunity.
2. is_opportunity is true only for: clear catering requests, private or large event requests, large-party (about 10+) or private dining reservation requests, complaints or service issues, and significant business inquiries.
3. Value estimate: ONLY when the customer states a guest count or an explicit monetary amount. Assumptions: catering $18-$30 per person; private events and large-party dining $50-$75 per person. If the customer states a spending amount, use it with High confidence. If only a guest count is known, use Medium confidence. Otherwise has_value_estimate is false — never invent a value. value_basis is a short plain-English calculation like "80 guests × $18–$30 per person".
4. customer_facts: ONLY what the customer actually wrote (guest counts, dates, requests), in one or two factual sentences. Never include your own assumptions.
5. relay_assessment: your assessment of why it matters, framed as an assessment ("May represent a significant catering opportunity."), never as something the customer said.
6. why_flagged: 1-2 factual sentences combining what the customer asked for and why it matters. Never mention AI, models, algorithms, or technology.
7. recommended_action: one specific action tied to the actual message (e.g. "Review and respond to catering inquiry"). Empty string when not an opportunity.
8. draft_response: a short, professional reply from the restaurant to this customer, signed with "${restaurantName}". Use ONLY facts from the customer's message — never invent prices, menu items, availability, discounts, catering packages, policies, or confirm a booking. If more details are needed, politely ask for them (event type, date, guest count, budget). Empty string when the email is irrelevant or no reply is appropriate.
9. priority: high for customer_service_issue and large or high-value opportunities; medium for clear opportunities with specifics; low otherwise.

Return JSON only.`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: ANALYSIS_SCHEMA,
  });
  return result;
}