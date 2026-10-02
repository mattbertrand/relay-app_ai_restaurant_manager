// Clearly isolated demo review datasets. These records are always created
// with is_demo = true and are never presented as live provider reviews. They
// exist so the full review workflow — detection, explanation, priority,
// Restaurant Profile context, recommended action, drafting, manager review,
// explicit publish, activity history — can be demonstrated before live
// provider API access is configured.
//
// Two datasets:
// - Oak & Vine: the original generic demonstration dataset.
// - HopMonk Tavern Novato: realistic demonstration reviews simulating what
//   Relay would do if HopMonk Tavern Novato (Novato, CA) were connected to
//   its Google Business Profile. Simulated only — never retrieved from
//   Google, never published to Google.

function daysAgoIso(days, hoursOffset = 0) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000 + hoursOffset * 60 * 60 * 1000).toISOString();
}

function hoursAgoIso(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// The HopMonk Tavern Novato demonstration dataset. Reviewer names are
// simulated; review text mirrors the restaurant's realistic public review
// patterns. No owner responses are included unless noted.
function buildHopMonkDemoReviews() {
  return [
    {
      external_review_id: "hopmonk-demo-01",
      reviewer_name: "Marcus D.",
      rating: 5,
      review_text: "No comment",
      review_created_at: hoursAgoIso(3),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
    {
      external_review_id: "hopmonk-demo-02",
      reviewer_name: "Karen W.",
      rating: 4,
      review_text:
        "Amazingly good food for the overall atmosphere. Sports/music/bro atmosphere. Tap list is very predictable. Plenty of TVs for sports. I brought my 80yo parents and they enjoyed their food. I had curry vegetables and was surprised by how flavorful it was. Good job! They could be way more creative with the tap list but other than that I thought it was a decent meal in a relaxing atmosphere.",
      review_created_at: daysAgoIso(6),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
    {
      external_review_id: "hopmonk-demo-03",
      reviewer_name: "Susan B.",
      rating: 5,
      review_text:
        "My husband and I go here every time we visit Novato for our holiday. Never had a bad meal from the extensive menus. The staff each and everyone of them are a credit to their boss. He should be really proud of all they do. Nissa in particular helped me through a very traumatic experience when my husband took I\u2019ll (thankfully he is okay now). She rallied the staff to help try and get him to our car but ended up suggesting 911. She calmed me down so much. We love this place and have nothing bad to say about it. Thanks Everyone \uD83D\uDE0A",
      review_created_at: daysAgoIso(7),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
    {
      external_review_id: "hopmonk-demo-04",
      reviewer_name: "Tyler R.",
      rating: 5,
      review_text: "Happy hour beer, great service! I did not order any food but from what I observed it looked amazing!",
      review_created_at: daysAgoIso(14),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
    {
      external_review_id: "hopmonk-demo-05",
      reviewer_name: "Melissa G.",
      rating: 5,
      review_text:
        "The burgers are amazing here. The kale salad is good. Would ask for less dressing next time. The salad with the burger was yummy. The service is so-so. They weren\u2019t even busy and we didn\u2019t get much attention. Not even water until the last moment but I had already gone to the bar to get some. They have line dancing on Thursdays. It looks fun!",
      review_created_at: daysAgoIso(14, -4),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
    {
      external_review_id: "hopmonk-demo-06",
      reviewer_name: "Robert F.",
      rating: 4,
      review_text:
        "First of all. I would like to thank the company for its participation in my neighborhood food truck night 2 years ago. Because of that event, I chose this place mainly on inclination as my circumstantial best dinner choice was to strand myself at Vintage Oaks. I liked that brownRice/blackBean burger but I didn\u2019t taste the root ingredients that I happen to like and I accepted the brioche bun due to it being all what\u2019s available. The Hopmonk pale ale was standardly good and so was the hazy a month later. Sometimes, the outside \u201Cknollio\u201D is pleasantly quiet. And, Vivien is a terrific waitress.",
      review_created_at: daysAgoIso(21),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
    {
      external_review_id: "hopmonk-demo-07",
      reviewer_name: "Dana P.",
      rating: 3,
      review_text: "Good American fair.",
      review_created_at: daysAgoIso(21, -5),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
    {
      external_review_id: "hopmonk-demo-08",
      reviewer_name: "Chris L.",
      rating: 4,
      review_text: "No comment",
      review_created_at: daysAgoIso(21, -9),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
    {
      external_review_id: "hopmonk-demo-09",
      reviewer_name: "Jenny S.",
      rating: 4,
      review_text:
        "Food was pretty good. I think my burger was more rare than medium but that could be my misunderstanding. I love the atmosphere as it looks like they have live music and outside looks comfy especially for friday nights or weekends on a nice night. The waiter was super nice but looked like he was 12. Nonetheless very nice place",
      review_created_at: daysAgoIso(30),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
    {
      external_review_id: "hopmonk-demo-10",
      reviewer_name: "Alex M.",
      rating: 5,
      review_text: "Tasty bar bar food, great music inside, pleasant bar staff",
      review_created_at: daysAgoIso(30, -3),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
    {
      external_review_id: "hopmonk-demo-11",
      reviewer_name: "Priya N.",
      rating: 5,
      review_text:
        "The Nashville hot chicken is legit! Live music at 4pm on Friday was nice on the patio. Great experience.",
      review_created_at: daysAgoIso(30, -6),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
    {
      external_review_id: "hopmonk-demo-12",
      reviewer_name: "George H.",
      rating: 4,
      review_text:
        "HopMonk Novato is an informal, pub style restaurant, bar, and music venue located in the outer parking lot area of the shopping center. The indoor area has a dark wood pub atmosphere and large bar, in addition to the back room indoor performance space. HopMonk's best feature is the large and comfortable patio. Tables are nicely separated and shaded by umbrellas. Dogs are welcome in the patio. The patio features a larger performance space which frequently hosts bands, some of which are well known. Service is friendly and capable. The menu is more extensive than would be expected for a pub restaurant. Food is good and attractively presented. Our favorites include the Reuben sandwich and the southwest chicken salad. On our most recent visit, the chicken breast was a bit overcooked and dry, but this has not been our regular experience. The fish and chips and pizza are also recommended. A good selection of California wines and microbrewery tap beers is offered, in addition to a full bar with a cocktail program. Satellite bars are located in the performance spaces. HopMonk is a great place for a relaxing drink and a good lunch or dinner.",
      review_created_at: daysAgoIso(30, -9),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
    {
      external_review_id: "hopmonk-demo-13",
      reviewer_name: "Sam K.",
      rating: 4,
      review_text: "No comment",
      review_created_at: daysAgoIso(30, -12),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
    {
      external_review_id: "hopmonk-demo-14",
      reviewer_name: "Lisa T.",
      rating: 3,
      review_text: "No comment",
      review_created_at: daysAgoIso(30, -15),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
    {
      external_review_id: "hopmonk-demo-15",
      reviewer_name: "Rachel W.",
      rating: 5,
      review_text:
        "I always have a great experience at HopMonk! The atmosphere is fantastic, the staff is friendly and attentive, and it\u2019s such a fun place to watch live music and have a good time with friends. Cheers!",
      review_created_at: daysAgoIso(30, -18),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
    {
      external_review_id: "hopmonk-demo-16",
      reviewer_name: "Derek O.",
      rating: 1,
      review_text:
        "I ordered delivery from Hopmonk and was severely disappointed. I ordered a hamburger with garlic fries and a side of boneless chicken wings. The hamburger was supposed to come with avocado an additional $3 which I never got, the french fries were soggy and had absolutely no garlic and the wings were dry and more breading than actual chicken. Plus no ranch dipping sauce and the veggies it came with looked as if they had been sitting out all day.",
      review_created_at: daysAgoIso(32),
      source_url: null,
      owner_response: "",
      owner_response_at: null,
    },
  ];
}

export function buildDemoReviews(restaurantName = "") {
  if (/hopmonk/i.test(String(restaurantName || ""))) {
    return buildHopMonkDemoReviews();
  }
  return buildOakVineDemoReviews();
}

function buildOakVineDemoReviews() {
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