// Clearly isolated demo review dataset for Oak & Vine. These records are
// always created with is_demo = true and are never presented as live Google
// reviews. They exist so the full review workflow — detection, explanation,
// priority, Restaurant Profile context, recommended action, drafting, manager
// review, explicit publish, activity history — can be demonstrated before
// Google API access is configured.

function daysAgoIso(days, hoursOffset = 0) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000 + hoursOffset * 60 * 60 * 1000).toISOString();
}

export function buildDemoReviews() {
  return [
    {
      external_review_id: "demo-rv-01",
      reviewer_name: "Melissa T.",
      rating: 5,
      review_text:
        "Best dinner we've had in years. The tasting menu was thoughtful and the service was warm without being fussy. We will absolutely be back for our anniversary.",
      review_created_at: daysAgoIso(2),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
      expected: { classification: "attention", category: "compliment", priority: "informational", needs_response: false },
    },
    {
      external_review_id: "demo-rv-02",
      reviewer_name: "Daniel R.",
      rating: 5,
      review_text:
        "Our server Claire took wonderful care of our whole family, including our daughter with a gluten allergy — the kitchen labeled everything and double-checked every course. Rare and appreciated.",
      review_created_at: daysAgoIso(4),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
      expected: { classification: "attention", category: "positive_feedback", priority: "informational", needs_response: false },
    },
    {
      external_review_id: "demo-rv-03",
      reviewer_name: "Priya S.",
      rating: 3,
      review_text:
        "The food was genuinely good, but we waited about 45 minutes after being seated before anyone took our order on a packed Friday night. Staff seemed kind but overwhelmed. Would try again on a quieter evening.",
      review_created_at: daysAgoIso(3),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
      expected: { classification: "attention", category: "service_issue", priority: "medium", needs_response: true },
    },
    {
      external_review_id: "demo-rv-04",
      reviewer_name: "Marcus W.",
      rating: 1,
      review_text:
        "Waited over an hour for our mains, half our order came out wrong, and no manager ever came by despite two requests. We left disappointed and still paid full price. Not the experience this place advertises.",
      review_created_at: daysAgoIso(1),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
      expected: { classification: "opportunity", category: "service_issue", priority: "high", needs_response: true },
    },
    {
      external_review_id: "demo-rv-05",
      reviewer_name: "Elena G.",
      rating: 2,
      review_text:
        "The pasta arrived lukewarm and under-seasoned, and my partner's steak came out well-done when he ordered medium rare. The flavors when the dishes were right were promising, which makes it more frustrating.",
      review_created_at: daysAgoIso(5),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
      expected: { classification: "opportunity", category: "food_quality", priority: "medium", needs_response: true },
    },
    {
      external_review_id: "demo-rv-06",
      reviewer_name: "Jordan K.",
      rating: 1,
      review_text:
        "I told our server about my child's severe peanut allergy before we ordered. The appetizer that arrived clearly had peanuts on it. The kitchen did remake it quickly once we flagged it, but this should never reach the table.",
      review_created_at: daysAgoIso(1, -3),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
      expected: { classification: "opportunity", category: "safety_allergen_concern", priority: "high", needs_response: true },
    },
    {
      external_review_id: "demo-rv-07",
      reviewer_name: "Tom H.",
      rating: 2,
      review_text:
        "Hosting was chaotic on Saturday and it took a while to be seated even with a reservation, but the manager comped our appetizers and was genuinely apologetic. Food made up for it.",
      review_created_at: daysAgoIso(9),
      source_url: null,
      owner_response:
        "Tom, thank you for your patience on Saturday — we fell short on the wait, and I'm glad we could make some of it up to you. We'd love to welcome you back. — Oak & Vine",
      owner_response_at: daysAgoIso(8),
      expected: { classification: "routine", category: "negative_experience", priority: "low", needs_response: false },
    },
    {
      external_review_id: "demo-rv-08",
      reviewer_name: "Aisha B.",
      rating: 4,
      review_text: "Great food and a lovely room. Parking nearby can be a bit tricky on weekends, but worth the walk.",
      review_created_at: daysAgoIso(7),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
      expected: { classification: "attention", category: "positive_feedback", priority: "informational", needs_response: false },
    },
    {
      external_review_id: "demo-rv-09",
      reviewer_name: "ReviewBoost Pro",
      rating: 5,
      review_text:
        "Get more 5-star reviews on autopilot! Our service guarantees top Google rankings for your business. Reply now for a free trial — limited spots this month!",
      review_created_at: daysAgoIso(4, -6),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
      expected: { classification: "spam", category: "spam_irrelevant", priority: "informational", needs_response: false },
    },
    {
      external_review_id: "demo-rv-10",
      reviewer_name: "Sofia L.",
      rating: 2,
      review_text:
        "Tried to book a table for 15 for my mom's birthday online and it kept rejecting the party size. Called instead and got it sorted, but the website gave no guidance for larger groups. The dinner itself was lovely.",
      review_created_at: daysAgoIso(6),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
      expected: { classification: "attention", category: "reservation_issue", priority: "medium", needs_response: true },
    },
  ];
}