import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { analyzeEmail } from "../../shared/emailAnalysis.ts";

// Controlled test scenarios for the Gmail → opportunity pipeline.
// Runs the shared analysis against sample emails without touching real data.

const SCENARIOS = [
  {
    name: 'High-value catering',
    subject: 'Corporate Catering Inquiry',
    body: "Hi, we're planning a company event for approximately 80 people on October 15. Do you offer catering and could you send us some pricing information?",
    expectedCategory: 'catering_inquiry',
    expectOpportunity: true,
    expectValue: true,
  },
  {
    name: 'Ordinary question',
    subject: 'Sunday Hours',
    body: 'Hi, are you open this Sunday?',
    expectedCategory: 'general_inquiry',
    expectOpportunity: false,
    expectValue: false,
  },
  {
    name: 'Private event',
    subject: 'Private Dinner',
    body: "Hi, I'm looking to host a private birthday dinner for around 40 people next month. Do you have a private dining area?",
    expectedCategory: 'private_event_inquiry',
    expectOpportunity: true,
    expectValue: true,
  },
  {
    name: 'Complaint',
    subject: 'Issue with our visit',
    body: 'We visited last Saturday and unfortunately had a very disappointing experience. I would like to speak with a manager.',
    expectedCategory: 'customer_service_issue',
    expectOpportunity: true,
    expectValue: false,
  },
  {
    name: 'Newsletter / irrelevant',
    subject: 'Weekly Newsletter',
    body: 'Check out our latest deals and updates! Click here to read more. Unsubscribe anytime.',
    expectedCategory: 'irrelevant',
    expectOpportunity: false,
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
          expectedCategory: s.expectedCategory,
          actualCategory: analysis.category,
          isOpportunity: analysis.is_opportunity,
          expectedOpportunity: s.expectOpportunity,
          title: analysis.title || null,
          whyFlagged: analysis.why_flagged || null,
          recommendedAction: analysis.recommended_action || null,
          hasValueEstimate: analysis.has_value_estimate === true,
          expectedValue: s.expectValue,
          valueConfidence: analysis.value_confidence || null,
          pass:
            analysis.category === s.expectedCategory &&
            analysis.is_opportunity === s.expectOpportunity &&
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