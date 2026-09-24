import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { analyzeEmail } from "../../shared/emailAnalysis.ts";

// Controlled test scenarios for the Gmail → opportunity pipeline.
// Runs the shared analysis against sample emails without touching real data.

const SCENARIOS = [
  {
    name: 'Simple reservation request',
    subject: 'Dinner Reservation',
    body: 'Hi, we would like to make a reservation at your restaurant.',
    expectedClassification: 'opportunity',
    expectedCategory: 'reservation_inquiry',
    expectValue: false,
  },
  {
    name: 'Brief reservation request',
    subject: 'Reservation',
    body: 'Hello, I need to make a reservation.',
    expectedClassification: 'opportunity',
    expectedCategory: 'reservation_inquiry',
    expectValue: false,
  },
  {
    name: 'Failed reservation attempt',
    subject: 'Reservation Trouble',
    body: 'Hi, we tried making a reservation for 3 people for 9/24 at 6pm, but we were unable to do so. Could you please let us know if we can make that reservation?',
    expectedClassification: 'opportunity',
    expectedCategory: 'reservation_issue',
    expectValue: false,
  },
  {
    name: 'High-value catering',
    subject: 'Corporate Catering Inquiry',
    body: "Hi, we're planning a company event for approximately 80 people on October 15. Do you offer catering and could you send us some pricing information?",
    expectedClassification: 'opportunity',
    expectedCategory: 'catering_inquiry',
    expectValue: true,
  },
  {
    name: 'Catering with stated budget',
    subject: 'Catering for 30',
    body: 'Hello, I am organizing a team lunch for 30 people next Friday and my budget is around $1,500. Do you do catering for something like that?',
    expectedClassification: 'opportunity',
    expectedCategory: 'catering_inquiry',
    expectValue: true,
  },
  {
    name: 'Private event',
    subject: 'Private Dinner',
    body: "Hi, I'm looking to host a private birthday dinner for around 40 people next month. Do you have a private dining area?",
    expectedClassification: 'opportunity',
    expectedCategory: 'private_event_inquiry',
    expectValue: true,
  },
  {
    name: 'Complaint about a visit',
    subject: 'Issue with our visit',
    body: 'We visited last Saturday and unfortunately had a very disappointing experience. I would like to speak with a manager.',
    expectedClassification: 'opportunity',
    expectedCategory: 'customer_service_issue',
    expectValue: false,
  },
  {
    name: 'Billing / gratuity dispute',
    subject: 'Gratuity charge on our bill',
    body: 'Hello, we dined with you last night and were charged an automatic 20% gratuity that nobody mentioned to us. Could you please review the bill and explain the charge?',
    expectedClassification: 'opportunity',
    expectedCategory: 'customer_service_issue',
    expectValue: false,
  },
  {
    name: 'Loyalty program question',
    subject: 'Loyalty program',
    body: 'Hi, do you have a loyalty program or any rewards for regular customers?',
    expectedClassification: 'attention',
    expectValue: false,
  },
  {
    name: 'Ordinary question',
    subject: 'Sunday Hours',
    body: 'Hi, are you open this Sunday?',
    expectedClassification: 'routine',
    expectValue: false,
  },
  {
    name: 'Job application',
    subject: 'Bartender Position',
    body: 'Hello, I am an experienced bartender interested in joining your team. I have attached my resume and would love to discuss any open positions.',
    expectedClassification: 'routine',
    expectValue: false,
  },
  {
    name: 'Newsletter / irrelevant',
    subject: 'Weekly Newsletter',
    body: 'Check out our latest deals and updates! Click here to read more. Unsubscribe anytime.',
    expectedClassification: 'spam',
    expectedCategory: 'irrelevant',
    expectValue: false,
  },
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const restaurantId = user.restaurant_id || (user.data && user.data.restaurant_id);
    let restaurantName = 'Oak & Vine';
    if (restaurantId) {
      try {
        const restaurant = await base44.entities.Restaurant.get(restaurantId);
        if (restaurant && restaurant.name) restaurantName = restaurant.name;
      } catch (e) {
        // fall back to the default name
      }
    }

    const results = [];
    for (const s of SCENARIOS) {
      try {
        const analysis = await analyzeEmail(base44, restaurantName, {
          senderName: 'Test Sender',
          senderEmail: 'test.sender@example.com',
          subject: s.subject,
          body: s.body,
        });
        results.push({
          scenario: s.name,
          expectedClassification: s.expectedClassification,
          actualClassification: analysis.classification,
          actualCategory: analysis.category,
          hasValueEstimate: analysis.has_value_estimate === true,
          expectedValue: s.expectValue,
          valueConfidence: analysis.value_confidence || null,
          pass:
            analysis.classification === s.expectedClassification &&
            (!s.expectedCategory || analysis.category === s.expectedCategory) &&
            analysis.has_value_estimate === s.expectValue,
        });
      } catch (e) {
        results.push({ scenario: s.name, error: e.message, pass: false });
      }
    }

    return Response.json({ restaurantName, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}