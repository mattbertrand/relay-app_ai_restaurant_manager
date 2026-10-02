// Shared review analysis — classifies one review the same way email analysis
// works: Restaurant Profile first, review content second, Relay inference
// clearly separated. Used by the review sync and by re-analysis.

import { loadKnowledge, loadRecentFeedback, formatKnowledgeForPrompt } from "./restaurantKnowledge.ts";
import { providerFor } from "./reviewProviders.ts";

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    classification: {
      type: "string",
      enum: ["opportunity", "attention", "routine", "spam"],
      description:
        "opportunity = a customer/reputation matter requiring real manager work; attention = worth a manager's glance but not a work item; routine = ordinary or already handled; spam = irrelevant or promotional.",
    },
    confidence: { type: "string", enum: ["High", "Medium", "Low"] },
    category: {
      type: "string",
      enum: [
        "positive_feedback",
        "compliment",
        "negative_experience",
        "service_issue",
        "food_quality",
        "staff_issue",
        "cleanliness",
        "reservation_issue",
        "pricing_value",
        "policy_complaint",
        "safety_allergen_concern",
        "spam_irrelevant",
      ],
    },
    priority: {
      type: "string",
      enum: ["high", "medium", "low", "informational"],
      description:
        "high = serious complaint, safety/allergen concern, severe or potentially damaging unresolved issue; medium = meaningful complaint that merits a response; low = minor complaint; informational = positive review, simple compliment, or review requiring no action. NEVER derived from star rating alone — judge the content.",
    },
    intent: {
      type: "string",
      description: "2-4 words naming what happened, e.g. 'Slow Service', 'Allergy Incident', 'Praise for Staff'. Empty for spam.",
    },
    why_flagged: {
      type: "string",
      description:
        "1-2 sentences of concrete evidence from the review, in neutral factual terms: for reviews needing attention, why it matters; for reviews that do not, why no action is needed. Never frame a non-issue as a problem. Never mention AI, models, or technology. Never invent facts.",
    },
    knowledge_used: {
      type: "string",
      description:
        "Which verified Restaurant Profile facts applied to this review, or a plain statement that the profile does not contain the needed information. Never list inferred or invented facts.",
    },
    recommended_action: {
      type: "string",
      description:
        "One specific action tied to the actual review content, informed by the Restaurant Profile where it applies. Empty string for routine and spam.",
    },
    draft_response: {
      type: "string",
      description: "A suggested PUBLIC response the manager would post under the review. Empty string when no public response is warranted.",
    },
    needs_response: { type: "boolean", description: "Whether a public response is warranted." },
  },
  required: ["classification", "confidence", "category", "priority", "why_flagged", "needs_response"],
};

export const REVIEW_CLASSIFICATION_LABELS = {
  opportunity: "Opportunity",
  attention: "Attention",
  routine: "Routine",
  spam: "Spam",
};

export const REVIEW_CATEGORY_LABELS = {
  positive_feedback: "Positive feedback",
  compliment: "Compliment",
  negative_experience: "Negative experience",
  service_issue: "Service issue",
  food_quality: "Food quality issue",
  staff_issue: "Staff issue",
  cleanliness: "Cleanliness issue",
  reservation_issue: "Reservation issue",
  pricing_value: "Pricing / value complaint",
  policy_complaint: "Policy complaint",
  safety_allergen_concern: "Safety / allergen concern",
  spam_irrelevant: "Spam / irrelevant",
};

export async function classifyReview(base44, restaurantName, review, options = {}) {
  const knowledgeBlock = options.knowledgeContext
    ? `

VERIFIED RESTAURANT PROFILE (entered or confirmed by the restaurant manager — the authoritative source for restaurant-specific facts)
${options.knowledgeContext}`
    : `

VERIFIED RESTAURANT PROFILE
(None provided yet. You must NOT invent any restaurant facts — hours, policies, procedures, none of it. If judging this review needs a restaurant-specific fact the profile lacks, say so plainly in knowledge_used and never state the fact as known.)`;

  const tz = options.timezone || "";
  const providerLabel = options.providerLabel
    || (providerFor(review.provider) ? providerFor(review.provider).label : review.provider || "the provider");
  const ownerBlock = review.owner_response
    ? `

EXISTING PUBLIC OWNER RESPONSE (already posted at the provider):
"${String(review.owner_response).slice(0, 800)}"
An owner response already exists — Relay considers it when determining whether another public response is needed. Ordinarily this review needs no further public response (needs_response false). An existing response NEVER by itself means the underlying issue is resolved: judge the internal follow-up need independently of the response. If the review still reveals a serious unresolved issue the manager must act on internally, classify it accordingly (opportunity or attention) even though no new public response is drafted.`
    : "";

  const prompt = `You are reviewing one customer review for "${restaurantName}", a restaurant. Relay's promise to the restaurant is: "Never let another customer opportunity fall through the cracks." Your job is to understand what actually happened in this review and decide how much of the manager's attention it deserves.

THREE SOURCES OF INFORMATION — keep them strictly separate:
1. VERIFIED RESTAURANT INFORMATION (below): facts the manager entered. Authoritative. Never contradict, never extend.
2. CUSTOMER-PROVIDED INFORMATION: only what the reviewer actually wrote.
3. YOUR INFERENCE: reasoning combining the two. Never present an inference as a verified restaurant fact.

${knowledgeBlock}${ownerBlock}

REVIEW (provider: ${providerLabel}${review.is_demo ? " — DEMO DATA, not a live provider" : ""})
Reviewer: ${review.reviewer_name || "Unknown"}
Star rating: ${review.rating || "not stated"} out of 5
Posted: ${review.review_created_at || "unknown"}
Review text:
${review.review_text || "(no text)"}

CLASSIFICATION (choose exactly one)
- opportunity: the review represents a customer-reputation matter requiring real manager work — serious complaints, service failures worth internal follow-up, food quality issues, safety or allergen concerns, repeated operational problems, or anything that could damage the restaurant if left unaddressed.
- attention: worth the manager's glance but not necessarily a work item — balanced feedback with a minor note, praise highlighting something worth recognizing, mild complaints the restaurant may simply acknowledge.
- routine: positive reviews needing nothing, complaints that have already been publicly and adequately answered by the owner, or ordinary feedback with no issue raised.
- spam: promotional content, irrelevant advertising, review-bait, or content unrelated to the restaurant.

IMPORTANT on classification: do NOT force every review into opportunity. A 5-star compliment is attention/informational at most. A review the owner already answered well is routine. Spam is spam.

NO-TEXT REVIEWS: if the review has no text (a star rating with no comment, or "no comment"), do NOT invent reasons why the customer was satisfied or dissatisfied. Judge from the rating and context alone, say plainly in why_flagged that the review contains no text, keep confidence Low, and typically classify it routine with informational priority and needs_response false.

OUTDATED REVIEW INFORMATION: if the review states something that conflicts with the VERIFIED RESTAURANT PROFILE (e.g. an old policy, menu item, or hours), treat the profile as current, treat the review's statement as possibly outdated customer-provided information, and note the conflict in why_flagged or knowledge_used. Never repeat an outdated review statement as current fact.

UNCERTAIN CLAIMS: if the reviewer themselves expresses uncertainty (e.g. "I think my burger was more rare than medium but that could be my misunderstanding"), preserve their uncertainty — never state as fact that the restaurant made the error.

PRIORITY — judge the CONTENT, never the star rating alone. A 3-star review that identifies a serious operational issue outranks a 1-star rant with no specifics.
- high: safety or allergen incidents, severe service failures, repeated issues, or anything seriously damaging if unresolved.
- medium: a meaningful complaint that merits a response or internal follow-up (service, food quality, reservation, pricing).
- low: minor complaints.
- informational: positive reviews, compliments, or anything requiring no action.

WHY THIS MATTERS: cite the review's actual evidence in neutral, factual terms (e.g. "The reviewer reports a 45-minute wait before receiving service — a customer-service issue that may warrant manager follow-up."). For reviews that do not need attention, explain plainly why no action is needed (e.g. "A positive review of the pasta special — no issue raised; no action needed."). Never frame a non-issue as a problem. No generic language, no invented details, no mention of AI or technology.

KNOWLEDGE USED: only verified profile facts that actually applied, or a plain statement that the profile lacks them. Examples of profile influence: an allergy/safety policy ("Allergen complaints must be escalated to a manager"), a service-recovery policy, large-party booking process, operating procedures.

RECOMMENDED ACTION: one specific, concrete step — e.g. "Investigate Friday-evening staffing levels on the floor" or "Follow the profile's escalation process for allergen incidents". Must not assume actions already taken.

DRAFT PUBLIC RESPONSE (only when a public response is warranted — needs_response true):
A short, professional, public reply the restaurant would post under this review, signed "${restaurantName}". Rules:
- Acknowledge the reviewer's experience specifically — never argue, never dispute their account.
- Use ONLY facts from the review and the VERIFIED RESTAURANT PROFILE. Never invent policies, offers, discounts, or compensation — unless the profile explicitly authorizes it.
- Do not expose internal restaurant information (staffing details, internal processes, other customers).
- Never mention AI, automation, or how the response was produced.
- A public response never confirms the underlying issue is resolved — it may invite the reviewer to contact the restaurant directly.
- For positive reviews, needs_response is typically false (no public reply needed) unless a warm short thank-you adds real value.
- Empty string when no response is warranted.

Return JSON only.`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: REVIEW_SCHEMA,
  });
  return result;
}

// Builds the Review record updates from an analysis. The manager's edited
// draft is never overwritten; a re-classification clears stale drafts only
// when they are still Relay-generated.
export function reviewUpdatesFor(analysis, existing = {}, options = {}) {
  const classification = analysis.classification || "routine";
  const label = REVIEW_CLASSIFICATION_LABELS[classification] || "Routine";
  const updates = {
    classification: label,
    category: analysis.category || null,
    priority: analysis.priority || "informational",
    confidence: analysis.confidence || "Medium",
    why_flagged: analysis.why_flagged || "",
    knowledge_used: analysis.knowledge_used || "",
    recommended_action: analysis.recommended_action || "",
    last_analyzed_at: new Date().toISOString(),
  };
  if (analysis.intent) updates.intent = analysis.intent;
  const managerEdited = !!existing.draft_edited;
  if (!managerEdited) {
    updates.draft_response = analysis.needs_response ? analysis.draft_response || "" : "";
    updates.response_status = analysis.needs_response && analysis.draft_response ? "draft_ready" : "no_response_needed";
    if (!analysis.needs_response) updates.draft_edited = false;
  }
  return updates;
}