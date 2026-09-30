import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { analyzeEmail } from "../../shared/emailAnalysis.ts";
import {
  loadKnowledge,
  loadRecentFeedback,
  formatKnowledgeForPrompt,
  formatAdminContextForPrompt,
  formatCorrectionsForPrompt,
} from "../../shared/restaurantKnowledge.ts";

// Controlled test scenarios for the Gmail → analysis pipeline, run against
// this restaurant's verified Restaurant Profile. Nothing is written to real
// data — the manager can see exactly how Relay would classify and answer.
const SCENARIOS = [
  {
    name: 'Simple reservation request',
    subject: 'Dinner Reservation',
    body: "Hi, I'd like to make a reservation for 3 people Sunday at 6 PM.",
    expectedClassification: 'opportunity',
    expectedCategory: 'reservation',
    expectValue: false,
  },
  {
    name: 'Brief reservation request',
    subject: 'Reservation',
    body: 'Hello, I need to make a reservation.',
    expectedClassification: 'opportunity',
    expectedCategory: 'reservation',
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
    name: 'Large party above the standard maximum',
    subject: 'Reservation for 12',
    body: 'Hi, can I make a reservation for 12 people on Saturday night?',
    expectedClassification: 'opportunity',
    // 12 guests sits on the party-size boundary — reservation or private_event
    // are both legitimate readings of the same rules.
    expectedCategories: ['reservation', 'private_event'],
    expectValue: true,
  },
  {
    name: 'High-value catering',
    subject: 'Corporate Catering Inquiry',
    body: "Hi, we're planning a company event for approximately 80 people on October 15. Do you offer catering and could you send us some pricing information?",
    expectedClassification: 'opportunity',
    expectedCategory: 'catering',
    expectValue: true,
  },
  {
    name: 'Catering with stated budget',
    subject: 'Catering for 30',
    body: 'Hello, I am organizing a team lunch for 30 people next Friday and my budget is around $1,500. Do you do catering for something like that?',
    expectedClassification: 'opportunity',
    expectedCategory: 'catering',
    expectValue: true,
  },
  {
    name: 'Company holiday party for 50',
    subject: 'Company Holiday Party',
    body: "Hi, we're looking for a place for our company holiday party for 50 people. Do you host private events?",
    expectedClassification: 'opportunity',
    expectedCategory: 'private_event',
    expectValue: true,
  },
  {
    name: 'Complaint about a visit',
    subject: 'Issue with our visit',
    body: 'We visited last Saturday and unfortunately had a very disappointing experience. I would like to speak with a manager.',
    expectedClassification: 'opportunity',
    expectedCategory: 'customer_service',
    expectValue: false,
  },
  {
    name: 'Billing / gratuity dispute',
    subject: 'Gratuity charge on our bill',
    body: 'Hello, we dined with you last night and were charged an automatic 20% gratuity that nobody mentioned to us. Could you please review the bill and explain the charge?',
    expectedClassification: 'opportunity',
    expectedCategory: 'customer_service',
    expectValue: false,
  },
  {
    name: 'Sunday hours question',
    subject: 'Sunday Hours',
    body: 'Hi, are you open this Sunday?',
    expectedClassification: 'attention',
    expectedCategory: 'general_customer_inquiry',
    expectValue: false,
  },
  {
    name: 'Hours question with a typo',
    subject: 'Opening hours',
    body: 'Hello, what are your oping hours on Tuesday? Thanks',
    expectedClassification: 'attention',
    expectedCategory: 'general_customer_inquiry',
    expectValue: false,
  },
  {
    name: 'Requested time outside verified hours',
    subject: 'Sunday at 10 AM',
    body: 'Hi, can we come at 10 AM on Sunday?',
    expectedClassification: 'attention',
    expectedCategory: 'general_customer_inquiry',
    expectValue: false,
  },
  {
    name: 'Loyalty program question',
    subject: 'Loyalty program',
    body: 'Hi, do you have a loyalty program or any rewards for regular customers?',
    expectedClassification: 'attention',
    expectedCategory: 'general_customer_inquiry',
    expectValue: false,
  },
  {
    name: 'Unknown information (valet parking)',
    subject: 'Valet Parking',
    body: 'Hi, do you have valet parking?',
    expectedClassification: 'attention',
    expectedCategory: 'general_customer_inquiry',
    expectValue: false,
  },
  {
    // With verified HR information in the Restaurant Profile, a short factual
    // draft answering the question is correct — never a customer Opportunity.
    name: 'Job application',
    subject: 'Bartender Position',
    body: 'Hello, I am an experienced bartender interested in joining your team. I have attached my resume and would love to discuss any open positions.',
    expectedClassification: 'administrative',
    expectedCategory: 'job_application',
    expectValue: false,
  },
  {
    name: 'Job application follow-up',
    subject: 'Following up on my application',
    body: 'Hello, I am following up on the server position application I sent last week. I remain very interested in the opportunity.',
    expectedClassification: 'administrative',
    expectedCategory: 'job_application',
    expectValue: false,
  },
  {
    name: 'No actionable intent',
    subject: 'Test',
    body: 'Test',
    expectedClassification: 'routine',
    expectedCategory: 'non_actionable',
    expectValue: false,
  },
  {
    name: 'Newsletter / irrelevant',
    subject: 'Weekly Newsletter',
    body: 'Check out our latest deals and updates! Click here to read more. Unsubscribe anytime.',
    expectedClassification: 'spam',
    expectValue: false,
  },
  {
    name: 'Impossible date: September 31',
    subject: 'Reservation request',
    body: 'Hello, I need to make a reservation for 8 people for Tuesday 9/31 at 1pm.',
    expectedClassification: 'opportunity',
    expectedCategory: 'reservation',
    expectValue: false,
    expectedDateIssue: 'impossible_date',
  },
  {
    name: 'Valid date, wrong weekday: Tuesday September 30, 2026',
    subject: 'Reservation for 30-40 people',
    body: 'Hello, I need to make a reservation for 30-40 people for Tuesday, September 30, 2026.',
    expectedClassification: 'opportunity',
    // 30-40 guests may be categorized as reservation or private_event
    // depending on the verified party-size limits — the date issue is the point.
    expectValue: true,
    expectedDateIssue: 'weekday_mismatch',
  },
  {
    name: 'HR question: are you hiring?',
    subject: 'Are you hiring?',
    body: 'Hi, are you currently hiring servers? I have three years of experience and would love to apply.',
    senderEmail: 'jobseeker@example.com',
    expectedClassification: 'administrative',
    expectedCategory: 'job_application',
    expectValue: false,
    // The profile's verified HR information should power a short factual draft
    expectedDraft: true,
  },
  {
    name: 'Where to apply question',
    subject: 'How can I apply?',
    body: 'Hello, where can I apply to work at your restaurant?',
    senderEmail: 'applicant@example.com',
    expectedClassification: 'administrative',
    expectedCategory: 'job_application',
    expectValue: false,
    expectedDraft: true,
  },
  {
    name: 'Invoice from a known vendor',
    subject: "Invoice for this week's produce delivery",
    body: "Please find our invoice attached for this week's produce delivery, payment terms net 30.",
    senderEmail: 'orders@cascadeproduce.example.com',
    expectedClassification: 'administrative',
    expectedCategories: ['vendor', 'billing_administrative'],
    expectValue: false,
  },
  {
    // Obvious promotional cold outreach stays conservative: Spam — never an
    // Opportunity, and the profile's vendor list does not identify the sender.
    name: 'Unknown vendor cold outreach',
    subject: 'Premium linens for your restaurant',
    body: 'We supply premium restaurant linens at unbeatable prices. Reply for a free quote!',
    senderEmail: 'sales@textilepros.example.com',
    expectedClassification: 'spam',
    expectedCategories: ['spam', 'irrelevant_promotional', 'newsletter'],
    expectValue: false,
  },
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const restaurantId = user.restaurant_id || (user.data && user.data.restaurant_id);
    let restaurantName = 'the restaurant';
    let knowledgeContext = null;
    let corrections = [];
    let knowledgeRecordForAdmin = null;
    if (restaurantId) {
      try {
        const restaurant = await base44.entities.Restaurant.get(restaurantId);
        if (restaurant && restaurant.name) restaurantName = restaurant.name;
      } catch (e) {
        // fall back to the default name
      }
      // Run the scenarios against this restaurant's verified knowledge and
      // past manager corrections — the same context a real email gets.
      try {
        const [knowledgeRecord, feedback] = await Promise.all([
          loadKnowledge(base44, restaurantId),
          loadRecentFeedback(base44, restaurantId),
        ]);
        knowledgeContext = formatKnowledgeForPrompt(knowledgeRecord);
        corrections = formatCorrectionsForPrompt(feedback);
        // The profile's administration sections (HR, vendors, finance, …) are
        // selected per scenario inside the loop below.
        knowledgeRecordForAdmin = knowledgeRecord;
      } catch (e) {
        // run without knowledge context
      }
    }

    // Optional subset: payload { scenarios: ["name", ...] } runs only those —
    // a full pass makes one model call per scenario.
    const payload = await req.json().catch(() => ({}));
    const only = Array.isArray(payload.scenarios) ? payload.scenarios : null;
    const scenarios = only ? SCENARIOS.filter((s) => only.includes(s.name)) : SCENARIOS;
    const results = [];
    for (const s of scenarios) {
      try {
        const analysis = await analyzeEmail(base44, restaurantName, {
          senderName: 'Test Sender',
          senderEmail: s.senderEmail || 'test.sender@example.com',
          subject: s.subject,
          body: s.body,
        }, {
          knowledgeContext,
          adminContext: formatAdminContextForPrompt(knowledgeRecordForAdmin, {
            senderEmail: s.senderEmail || 'test.sender@example.com',
            subject: s.subject,
            body: s.body,
          }),
          corrections,
        });
        results.push({
          scenario: s.name,
          expectedClassification: s.expectedClassification,
          actualClassification: analysis.classification,
          actualCategory: analysis.category,
          hasValueEstimate: analysis.has_value_estimate === true,
          expectedValue: !!s.expectValue,
          valueConfidence: analysis.value_confidence || null,
          dateIssue: analysis.date_issue || null,
          draft: analysis.draft_response || null,
          knowledgeUsed: analysis.knowledge_used || null,
          pass:
            analysis.classification === s.expectedClassification &&
            (!s.expectedCategory || analysis.category === s.expectedCategory) &&
            analysis.has_value_estimate === !!s.expectValue &&
            (!s.expectedDateIssue || analysis.date_issue === s.expectedDateIssue) &&
            (!s.expectedNoDraft || !analysis.draft_response) &&
            (!s.expectedDraft || !!analysis.draft_response) &&
            (!s.expectedCategories || s.expectedCategories.includes(analysis.category)),
        });
      } catch (e) {
        results.push({ scenario: s.name, error: e.message, pass: false });
      }
    }

    // Compact summary first so long draft outputs can't hide the outcome.
    const failed = results.filter((r) => !r.pass).map((r) => r.scenario);
    return Response.json({
      restaurantName,
      summary: { total: results.length, passed: results.length - failed.length, failed },
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}