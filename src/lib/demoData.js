// Demo data generator for new restaurants. All records are flagged is_demo: true
// so the UI can clearly label them as demonstration data.
//
// Data quality rules for demo records:
// - Draft responses must read as if written by a professional restaurant manager.
// - Draft responses must not invent pricing, availability, menus, discounts, or policies.
// - "why_identified" must clearly separate what the customer actually said from
//   Relay's estimate, without vague technology language.
// - Every activity is tied to the specific opportunity it belongs to.

export function generateDemoOpportunities(restaurantId) {
  return [
    {
      restaurant_id: restaurantId,
      type: "Catering inquiry",
      title: "Catering for ~80 people",
      description:
        "Customer is asking about catering for approximately 80 people for a corporate luncheon on October 15th. They mentioned a preference for a mix of appetizers and entrees.",
      customer_name: "Maria Chen",
      customer_email: "maria.chen@brightpath.co",
      customer_phone: "(415) 555-0142",
      estimated_value_min: 1500,
      estimated_value_max: 2500,
      value_confidence: "Medium",
      value_basis: "80 guests × $18–$30 per person (demo pricing assumption).",
      priority: "high",
      status: "Needs Review",
      draft_status: "Draft",
      recommended_action:
        "Reply to Maria to gather service style, dietary needs, and budget details, then prepare a catering proposal for 80 guests.",
      source: "Email",
      notes: "Corporate client — potential for recurring orders.",
      original_message:
        "Hi, I'm organizing a corporate luncheon for about 80 people on October 15th and was wondering if you offer catering? We'd love a mix of appetizers and entrees. Could you send me some options and pricing? Thanks! — Maria",
      why_identified:
        "Customer mentioned catering for approximately 80 people on October 15 and asked for options and pricing. The potential value is an estimate based on the demo pricing assumption of $18–$30 per person — the customer has not shared a budget.",
      draft_response:
        "Hi Maria,\n\nThank you for reaching out about your corporate luncheon on October 15th. We'd be glad to help with catering for a group of 80.\n\nTo put together the right options and pricing, could you share a few more details?\n\n— Your preferred service style (buffet, family-style, or individually plated)\n— Any dietary requirements we should keep in mind\n— A rough budget range, if you have one\n\nOnce we have those details, we'll send over options that fit.\n\nBest regards,\nOak & Vine",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      type: "Private event inquiry",
      title: "Private patio event for 40 guests",
      description:
        "Customer wants to book the patio for a private 40th birthday celebration for approximately 40 guests on Saturday, October 19th.",
      customer_name: "James Patterson",
      customer_email: "j.patterson@gmail.com",
      customer_phone: "(415) 555-0198",
      estimated_value_min: 2000,
      estimated_value_max: 3000,
      value_confidence: "Medium",
      value_basis:
        "40 guests × $50–$75 per person for a private evening event (demo pricing assumption).",
      priority: "high",
      status: "Needs Response",
      draft_status: "Draft",
      recommended_action:
        "Reply to James to gather his preferences for the evening, then confirm patio availability for October 19th before sharing options.",
      source: "Website form",
      notes: "Saturday evening is high-demand. Confirm availability before sharing options.",
      original_message:
        "Hello, I'm planning a 40th birthday party for about 40 people and would love to use your patio. Are you available on Saturday, October 19th? What are the options and costs? Thanks, James",
      why_identified:
        "Customer asked about hosting a private birthday party for about 40 people on the patio on Saturday, October 19, and requested options and costs. The potential value is an estimate based on the demo pricing assumption for private evening events — availability and pricing have not yet been confirmed.",
      draft_response:
        "Hi James,\n\nThank you for reaching out, and congratulations on the upcoming birthday! We'd love to host your celebration.\n\nBefore we confirm patio availability for Saturday, October 19th, a couple of quick questions: would you prefer a seated dinner or a more cocktail-style reception, and do you have a budget in mind?\n\nOnce we've confirmed the date and your preferences, we'll share the options that fit.\n\nWarm regards,\nOak & Vine",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      type: "Unanswered inquiry",
      title: "Patio availability question",
      description:
        "Customer asked whether the patio is available for a private event. No response has been sent yet — the inquiry is 3 days old.",
      customer_name: "Sarah Williams",
      customer_email: "sarah.w@email.com",
      customer_phone: "",
      estimated_value_min: 800,
      estimated_value_max: 1500,
      value_confidence: "Low",
      value_basis: "25 guests × $32–$60 per person (demo pricing assumption).",
      priority: "medium",
      status: "Needs Response",
      draft_status: "Draft",
      recommended_action:
        "Reply to Sarah promptly to keep the inquiry warm — ask for her preferred date so availability can be confirmed.",
      source: "Google Business Profile",
      notes: "Inquiry is 3 days old — at risk of losing the customer.",
      original_message:
        "Hi, is your patio available for private events? Looking to host something for about 25 people.",
      why_identified:
        "Customer asked whether the patio is available for private events for about 25 people. No response has been sent in 3 days, which puts the inquiry at risk of being lost. The potential value is a rough estimate — the customer has not shared a date or budget.",
      draft_response:
        "Hi Sarah,\n\nThanks for your message! We'd be glad to look into a private event on the patio for your group of about 25.\n\nCould you share the date you have in mind and any preferences for the evening? Once we have the date, we can confirm availability and send over the options that would work.\n\nLooking forward to hearing more!\n\nOak & Vine",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      type: "Follow-up opportunity",
      title: "Catering follow-up from previous client",
      description:
        "A customer who ordered catering in June reached out asking for an updated menu — a warm opportunity to plan their next event.",
      customer_name: "Michael Torres",
      customer_email: "m.torres@nexussystems.com",
      customer_phone: "(415) 555-0177",
      estimated_value_min: 1000,
      estimated_value_max: 2000,
      value_confidence: "Medium",
      value_basis: "The customer's previous $1,800 catering order.",
      priority: "medium",
      status: "Needs Response",
      draft_status: "Draft",
      recommended_action:
        "Reply to Michael to confirm the date, guest count, and menu preferences for his upcoming event.",
      source: "Email",
      notes: "Previous order was $1,800. Returning client — respond promptly.",
      original_message:
        "Hi, we loved the catering you did for us in June. We might have another event coming up — can you send your updated menu?",
      why_identified:
        "Customer previously ordered catering in June and asked for an updated menu, which points to a likely upcoming event. The potential value is an estimate based on the customer's previous $1,800 order — the new event's details haven't been shared yet.",
      draft_response:
        "Hi Michael,\n\nIt's great to hear from you! We're glad the June catering went well, and we'd be happy to help with your next event.\n\nCould you share the date, expected guest count, and any menu preferences? Once we have those details, we'll put together options for you.\n\nBest regards,\nOak & Vine",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      type: "Reservation inquiry",
      title: "Large party reservation for 12",
      description:
        "Customer wants to make a reservation for 12 people this Friday at 7pm.",
      customer_name: "Emily Davis",
      customer_email: "emily.davis@email.com",
      customer_phone: "(415) 555-0123",
      estimated_value_min: 600,
      estimated_value_max: 900,
      value_confidence: "Low",
      value_basis: "12 guests × $50–$75 per person (demo pricing assumption).",
      priority: "low",
      status: "In Progress",
      draft_status: "Draft",
      recommended_action:
        "Confirm Friday evening availability for a party of 12 and reply with the details.",
      source: "Phone",
      notes: "Standard reservation — confirm availability before promising anything.",
      original_message:
        "Hi, I'd like to make a reservation for 12 people this Friday at 7pm. Is that possible?",
      why_identified:
        "Customer requested a reservation for 12 people this Friday at 7pm. Larger parties often involve set menus or deposits, which tend to increase the average ticket. The potential value is an estimate — the customer has not confirmed a menu or spending.",
      draft_response:
        "Hi Emily,\n\nThanks for reaching out about a reservation for 12 this Friday at 7pm. We'd be glad to have your group.\n\nI'll confirm availability for Friday evening and follow up shortly with the details. In the meantime, is there anything we should know about the group, such as dietary requirements?\n\nTalk soon,\nOak & Vine",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      type: "General customer inquiry",
      title: "Gluten-free menu options",
      description:
        "Customer asked about gluten-free options for an upcoming visit this weekend.",
      customer_name: "David Kim",
      customer_email: "dkim@email.com",
      customer_phone: "",
      estimated_value_min: 100,
      estimated_value_max: 300,
      value_confidence: "Low",
      value_basis: "A typical visit for a party of two (demo assumption).",
      priority: "low",
      status: "Completed",
      draft_status: "Approved",
      recommended_action:
        "Response approved with gluten-free options — the customer confirmed they'll visit this weekend.",
      source: "Instagram",
      notes:
        "Response approved in Relay (demo — no external message sent). Customer confirmed they'll visit this weekend.",
      original_message:
        "Do you have gluten-free options on your menu? Coming this weekend with a friend who has celiac.",
      why_identified:
        "Customer asked about gluten-free options ahead of a visit this weekend with a friend who has celiac. A prompt, helpful reply makes it more likely the visit happens. The potential value is a rough estimate of a typical table visit.",
      draft_response:
        "Hi David,\n\nThanks for reaching out! We can accommodate gluten-free diets, and our kitchen takes celiac requirements seriously. Just mention it to your server when you're seated and we'll make sure there are safe options for your friend.\n\nSee you this weekend!\n\nOak & Vine",
      is_demo: true,
    },
  ];
}

export function generateDemoConversations(restaurantId, opportunityIds) {
  const convos = [
    {
      restaurant_id: restaurantId,
      customer_name: "Maria Chen",
      customer_email: "maria.chen@brightpath.co",
      subject: "Catering for corporate luncheon",
      message:
        "Hi, I'm organizing a corporate luncheon for about 80 people on October 15th and was wondering if you offer catering? We'd love a mix of appetizers and entrees. Could you send me some options and pricing? Thanks! — Maria",
      status: "New",
      source: "Email",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      customer_name: "James Patterson",
      customer_email: "j.patterson@gmail.com",
      subject: "Private patio event",
      message:
        "Hello, I'm planning a 40th birthday party for about 40 people and would love to use your patio. Are you available on Saturday, October 19th? What are the options and costs? Thanks, James",
      status: "New",
      source: "Website form",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      customer_name: "Sarah Williams",
      customer_email: "sarah.w@email.com",
      subject: "Patio availability",
      message:
        "Hi, is your patio available for private events? Looking to host something for about 25 people.",
      status: "New",
      source: "Google Business Profile",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      customer_name: "Michael Torres",
      customer_email: "m.torres@nexussystems.com",
      subject: "Following up on summer catering",
      message:
        "Hi, we loved the catering you did for us in June. We might have another event coming up — can you send your updated menu?",
      status: "Needs Attention",
      source: "Email",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      customer_name: "Emily Davis",
      customer_email: "emily.davis@email.com",
      subject: "Reservation for 12",
      message:
        "Hi, I'd like to make a reservation for 12 people this Friday at 7pm. Is that possible?",
      status: "Needs Attention",
      source: "Phone",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      customer_name: "David Kim",
      customer_email: "dkim@email.com",
      subject: "Gluten-free options?",
      message:
        "Do you have gluten-free options on your menu? Coming this weekend with a friend who has celiac.",
      status: "Closed",
      source: "Instagram",
      is_demo: true,
    },
  ];

  // Link conversations to opportunities by index
  if (opportunityIds && opportunityIds.length >= convos.length) {
    convos.forEach((c, i) => {
      c.opportunity_id = opportunityIds[i];
    });
  }
  return convos;
}

export function generateDemoActions(restaurantId, opportunityIds) {
  return [
    {
      restaurant_id: restaurantId,
      opportunity_id: opportunityIds?.[0] || "",
      type: "Draft response",
      description:
        "Draft a response to Maria Chen asking for service style, dietary needs, and budget for her corporate luncheon.",
      status: "Pending Approval",
      requires_approval: true,
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      opportunity_id: opportunityIds?.[1] || "",
      type: "Draft response",
      description:
        "Draft a response to James Patterson about patio availability and options for his private event.",
      status: "Pending Approval",
      requires_approval: true,
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      opportunity_id: opportunityIds?.[3] || "",
      type: "Draft response",
      description:
        "Draft a response to Michael Torres about his upcoming event and catering options.",
      status: "Pending Approval",
      requires_approval: true,
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      opportunity_id: opportunityIds?.[4] || "",
      type: "Opportunity review",
      description:
        "Review Emily Davis's large party reservation and prepare a draft response.",
      status: "Completed",
      requires_approval: true,
      completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      opportunity_id: opportunityIds?.[5] || "",
      type: "Customer follow-up",
      description: "Draft response approved for David Kim's gluten-free menu inquiry.",
      status: "Completed",
      requires_approval: true,
      completed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      is_demo: true,
    },
  ];
}

export function generateDemoActivities(restaurantId, opportunityIds) {
  const id = (i) => opportunityIds?.[i] || "";
  return [
    {
      restaurant_id: restaurantId,
      opportunity_id: id(5),
      type: "opportunity_identified",
      description: "Opportunity identified: Gluten-free menu options from David Kim",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      opportunity_id: id(5),
      type: "draft_prepared",
      description: "Draft response created for David Kim's gluten-free menu inquiry",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      opportunity_id: id(5),
      type: "response_approved",
      description:
        "Response approved for David Kim's gluten-free menu inquiry — demo action completed, no external message was sent",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      opportunity_id: id(0),
      type: "opportunity_identified",
      description: "Opportunity identified: Catering for ~80 people from Maria Chen",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      opportunity_id: id(1),
      type: "opportunity_identified",
      description: "Opportunity identified: Private patio event for 40 guests from James Patterson",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      opportunity_id: id(4),
      type: "opportunity_identified",
      description: "Opportunity identified: Large party reservation for 12 from Emily Davis",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      opportunity_id: id(4),
      type: "draft_prepared",
      description: "Draft response created for Emily Davis's reservation inquiry",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      opportunity_id: id(4),
      type: "opportunity_reviewed",
      description: "Opportunity reviewed: Large party reservation for 12 from Emily Davis",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      opportunity_id: id(3),
      type: "opportunity_identified",
      description: "Opportunity identified: Catering follow-up from Michael Torres",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      opportunity_id: id(0),
      type: "draft_prepared",
      description: "Draft response created for Maria Chen's catering inquiry",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      opportunity_id: id(1),
      type: "draft_prepared",
      description: "Draft response created for James Patterson's private event inquiry",
      is_demo: true,
    },
    {
      restaurant_id: restaurantId,
      opportunity_id: id(2),
      type: "opportunity_identified",
      description: "Opportunity identified: Patio availability question from Sarah Williams",
      is_demo: true,
    },
  ];
}