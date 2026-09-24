import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import {
  GMAIL_CONNECTOR_ID,
  listInboxMessages,
  fetchMessage,
  getHeader,
  parseFromAddress,
  extractTextBody,
} from "../../shared/gmailApi.ts";
import { analyzeEmail, opportunityTypeFor, conversationOutcomeFor } from "../../shared/emailAnalysis.ts";
import { reprocessConversations } from "../../shared/reprocessConversations.ts";

const MAX_MESSAGES = 20;
const MAX_ANALYZE = 6;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const restaurantId = user.restaurant_id || (user.data && user.data.restaurant_id);
    if (!restaurantId) {
      return Response.json({ error: 'No restaurant is set up for this account yet.' }, { status: 400 });
    }

    let accessToken;
    try {
      ({ accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(GMAIL_CONNECTOR_ID));
    } catch (e) {
      return Response.json({ connected: false, error: 'Gmail is not connected.' }, { status: 200 });
    }

    const restaurant = await base44.entities.Restaurant.get(restaurantId);

    // Load existing records for duplicate and thread protection
    const [existingMsgs, convos, customers] = await Promise.all([
      base44.entities.ConversationMessage.filter({ restaurant_id: restaurantId }, null, 500),
      base44.entities.Conversation.filter({ restaurant_id: restaurantId }, null, 500),
      base44.entities.Customer.filter({ restaurant_id: restaurantId }, null, 500),
    ]);
    const seenMessageIds = new Set(existingMsgs.map((m) => m.gmail_message_id).filter(Boolean));
    const threadConvos = {};
    convos.forEach((c) => {
      if (c.gmail_thread_id) threadConvos[c.gmail_thread_id] = c;
    });
    const customersByEmail = {};
    customers.forEach((c) => {
      if (c.email) customersByEmail[c.email.toLowerCase()] = c;
    });

    // Re-run the current analysis on live Gmail conversations classified by an
    // earlier version of the classifier (skips importing new mail)
    const payload = await req.json().catch(() => ({}));
    if (payload.reprocess) {
      const reprocessSummary = await reprocessConversations({
        base44,
        restaurantId,
        restaurantName: restaurant.name || 'the restaurant',
        convos,
        messages: existingMsgs,
      });
      return Response.json(reprocessSummary);
    }

    const { messages: gmailMessages } = await listInboxMessages(accessToken);
    const summary = {
      connected: true,
      emailsChecked: gmailMessages.length,
      newMessages: 0,
      newThreads: 0,
      analyzed: 0,
      opportunitiesCreated: 0,
      attentionFlagged: 0,
      needsReview: 0,
    };

    const toAnalyze = [];
    const ownEmails = [restaurant.email]
      .map((e) => (e || '').toLowerCase())
      .filter(Boolean);

    const oldestFirst = [...gmailMessages].reverse();
    for (const gm of oldestFirst) {
      if (seenMessageIds.has(gm.id)) continue;
      if (summary.newMessages >= MAX_MESSAGES) break;

      let message;
      try {
        message = await fetchMessage(accessToken, gm.id);
      } catch (e) {
        continue;
      }

      const from = parseFromAddress(getHeader(message, 'From'));
      const fromEmail = (from.email || '').toLowerCase();
      const subject = getHeader(message, 'Subject') || '(no subject)';
      const body = extractTextBody(message.payload);
      const receivedAt = message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : new Date().toISOString();
      summary.newMessages++;

      // Skip the restaurant's own mail and automated senders
      if (ownEmails.includes(fromEmail)) continue;
      if (fromEmail.startsWith('no-reply') || fromEmail.startsWith('noreply')) continue;

      // Upsert the customer record
      const existingCustomer = customersByEmail[fromEmail];
      if (fromEmail && !existingCustomer) {
        const created = await base44.entities.Customer.create({
          restaurant_id: restaurantId,
          name: from.name,
          email: from.email,
          first_seen: receivedAt,
          last_contact: receivedAt,
          conversation_count: 1,
        });
        customersByEmail[fromEmail] = created;
      } else if (fromEmail && existingCustomer) {
        await base44.entities.Customer.update(existingCustomer.id, {
          last_contact: receivedAt,
          conversation_count: (existingCustomer.conversation_count || 0) + 1,
        });
      }

      const threadConvo = threadConvos[message.threadId];

      // Store the individual message (thread-linked, duplicate-protected by message id)
      await base44.entities.ConversationMessage.create({
        restaurant_id: restaurantId,
        conversation_id: threadConvo ? threadConvo.id : '',
        gmail_message_id: message.id,
        sender_name: from.name,
        sender_email: from.email,
        body: body.slice(0, 10000),
        received_at: receivedAt,
      });

      if (threadConvo) {
        // Existing thread: attach the reply, don't duplicate the conversation
        const nextStatus = threadConvo.opportunity_id
          ? threadConvo.status
          : threadConvo.status === 'Closed'
            ? 'Closed'
            : 'New';
        await base44.entities.Conversation.update(threadConvo.id, { status: nextStatus });
        await base44.entities.Activity.create({
          restaurant_id: restaurantId,
          opportunity_id: threadConvo.opportunity_id || '',
          type: 'email_received',
          description: `Email received: ${subject} from ${from.name}`,
        });
      } else {
        const convo = await base44.entities.Conversation.create({
          restaurant_id: restaurantId,
          customer_name: from.name,
          customer_email: from.email,
          subject,
          message: body.slice(0, 4000),
          status: 'New',
          source: 'Gmail',
          gmail_thread_id: message.threadId,
          gmail_message_id: message.id,
          received_at: receivedAt,
          analysis_status: 'Not analyzed',
          is_demo: false,
        });
        threadConvos[message.threadId] = convo;
        summary.newThreads++;
        await base44.entities.Activity.create({
          restaurant_id: restaurantId,
          opportunity_id: '',
          type: 'email_received',
          description: `Email received: ${subject} from ${from.name}`,
        });
        toAnalyze.push({
          convo,
          subject,
          body,
          senderName: from.name,
          senderEmail: from.email,
          receivedAt,
        });
      }
    }

    // Pick up threads from a previous capped run that were never analyzed
    const previouslyUnanalyzed = convos.filter(
      (c) =>
        c.analysis_status === 'Not analyzed' &&
        c.source === 'Gmail' &&
        !toAnalyze.some((t) => t.convo.id === c.id)
    );
    for (const c of previouslyUnanalyzed) {
      const firstMsg = existingMsgs.find((m) => m.conversation_id === c.id);
      toAnalyze.push({
        convo: c,
        subject: c.subject,
        body: firstMsg ? firstMsg.body : c.message,
        senderName: c.customer_name,
        senderEmail: c.customer_email,
        receivedAt: c.received_at,
      });
    }

    // Analyze new threads (bounded batch — the rest are picked up on the next sync)
    for (const item of toAnalyze.slice(0, MAX_ANALYZE)) {
      summary.analyzed++;
      let analysis;
      try {
        analysis = await analyzeEmail(base44, restaurant.name || 'the restaurant', {
          senderName: item.senderName,
          senderEmail: item.senderEmail,
          subject: item.subject,
          body: item.body,
        });
      } catch (e) {
        // Analysis failed — keep the email visible and flag it for manual review
        await base44.entities.Conversation.update(item.convo.id, {
          analysis_status: 'Needs review',
          status: 'Needs Attention',
        });
        summary.needsReview++;
        continue;
      }

      const classification = analysis.classification || 'routine';
      if (classification === 'opportunity') {
        const oppType = opportunityTypeFor(analysis.category) || analysis.opportunity_type || 'Business inquiry';
        const originalMessage = `Subject: ${item.subject}\n\n${item.body}`;
        const opp = await base44.entities.Opportunity.create({
          restaurant_id: restaurantId,
          type: oppType,
          title: analysis.title || item.subject,
          description: analysis.description || analysis.why_flagged,
          customer_name: item.senderName,
          customer_email: item.senderEmail,
          estimated_value_min: analysis.has_value_estimate ? analysis.estimated_value_min : null,
          estimated_value_max: analysis.has_value_estimate ? analysis.estimated_value_max : null,
          value_confidence: analysis.has_value_estimate ? analysis.value_confidence || 'Medium' : null,
          value_basis: analysis.has_value_estimate ? analysis.value_basis : null,
          priority: analysis.priority || 'medium',
          status: 'Needs Attention',
          draft_status: 'Draft',
          recommended_action: analysis.recommended_action || 'Review and respond to this inquiry',
          source: 'Gmail',
          original_message: originalMessage.slice(0, 8000),
          why_identified:
            [analysis.customer_facts, analysis.relay_assessment].filter(Boolean).join(' ') +
            ` Relay flagged this with ${analysis.confidence || 'Medium'} confidence.`,
          draft_response: analysis.draft_response || '',
          is_demo: false,
        });

        await base44.entities.Conversation.update(item.convo.id, {
          opportunity_id: opp.id,
          status: 'Opportunity',
          analysis_status: 'Opportunity',
        });

        if (analysis.draft_response) {
          await base44.entities.Action.create({
            restaurant_id: restaurantId,
            opportunity_id: opp.id,
            type: 'Draft response',
            description: `Draft a response to ${item.senderName} regarding "${item.subject}".`,
            status: 'Pending Approval',
            requires_approval: true,
          });
        }

        await base44.entities.Activity.create({
          restaurant_id: restaurantId,
          opportunity_id: opp.id,
          type: 'opportunity_identified',
          description: `Opportunity identified: ${opp.title} from ${item.senderName} (Gmail)`,
        });
        if (analysis.draft_response) {
          await base44.entities.Activity.create({
            restaurant_id: restaurantId,
            opportunity_id: opp.id,
            type: 'draft_prepared',
            description: `Draft response created for ${item.senderName}'s ${oppType.toLowerCase()}`,
          });
        }
        summary.opportunitiesCreated++;
      } else {
        await base44.entities.Conversation.update(item.convo.id, conversationOutcomeFor(classification));
        if (classification === 'attention') summary.attentionFlagged++;
      }
    }

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}