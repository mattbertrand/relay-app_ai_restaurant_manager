import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import {
  GMAIL_CONNECTOR_ID,
  listInboxMessages,
  fetchMessage,
  getHeader,
  parseFromAddress,
  extractTextBody,
} from "../../shared/gmailApi.ts";
import { analyzeEmail, opportunityTypeFor, conversationUpdatesFor } from "../../shared/emailAnalysis.ts";
import { findDuplicateConversation, linkFollowup } from "../../shared/dedupe.ts";
import { matchExistingConversation } from "../../shared/threadMatching.ts";
import {
  loadKnowledge,
  loadRecentFeedback,
  formatKnowledgeForPrompt,
  formatCorrectionsForPrompt,
} from "../../shared/restaurantKnowledge.ts";
import { reprocessConversations } from "../../shared/reprocessConversations.ts";

// Gmail sync for Relay — imports new mail, classifies it, and supports reprocessing.
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

    // Verified restaurant knowledge and this restaurant's manager corrections
    // steer the analysis: facts the manager entered are authoritative, and a
    // rule learned from one restaurant never affects another restaurant.
    const [knowledgeRecord, feedback] = await Promise.all([
      loadKnowledge(base44, restaurantId),
      loadRecentFeedback(base44, restaurantId),
    ]);
    const knowledgeContext = formatKnowledgeForPrompt(knowledgeRecord);
    const corrections = formatCorrectionsForPrompt(feedback);

    // Load existing records for duplicate and thread protection
    const [existingMsgs, convos, customers, opps] = await Promise.all([
      base44.entities.ConversationMessage.filter({ restaurant_id: restaurantId }, null, 500),
      base44.entities.Conversation.filter({ restaurant_id: restaurantId }, null, 500),
      base44.entities.Customer.filter({ restaurant_id: restaurantId }, null, 500),
      base44.entities.Opportunity.filter({ restaurant_id: restaurantId }, null, 500),
    ]);
    // The Gmail message ID is the single source of truth for "already
    // imported": it is checked against both message and conversation records
    // so a retry or overlapping sync can never import the same email twice.
    const seenMessageIds = new Set(
      [
        ...existingMsgs.map((m) => m.gmail_message_id),
        ...convos.map((c) => c.gmail_message_id),
      ].filter(Boolean)
    );
    const threadConvos = {};
    convos.forEach((c) => {
      if (c.gmail_thread_id) threadConvos[c.gmail_thread_id] = c;
    });
    const customersByEmail = {};
    customers.forEach((c) => {
      if (c.email) customersByEmail[c.email.toLowerCase()] = c;
    });
    // Reply relationships (In-Reply-To / References) let a message that Gmail
    // filed under a new thread ID still find the conversation it answers.
    const convoIdByRfcId = {};
    existingMsgs.forEach((m) => {
      if (m.gmail_rfc_id) convoIdByRfcId[m.gmail_rfc_id.trim().toLowerCase()] = m.conversation_id;
    });
    // Live Gmail conversations only — thread relationships are a Gmail concept.
    const liveConvos = convos.filter((c) => c.source === 'Gmail' && !c.is_demo);

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
      duplicatesMerged: 0,
      analyzed: 0,
      opportunitiesCreated: 0,
      followupsLinked: 0,
      reopened: 0,
      relatedMerged: 0,
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

      // Thread identity comes first and only from Gmail: thread ID, then
      // In-Reply-To / References. The sender is NEVER a relationship signal —
      // the same customer may have many completely separate matters.
      let threadConvo = threadConvos[message.threadId] || null;
      if (!threadConvo) {
        threadConvo = matchExistingConversation({
          convos: liveConvos,
          rfcToConversationId: convoIdByRfcId,
          threadId: message.threadId,
          inReplyTo: getHeader(message, 'In-Reply-To'),
          references: getHeader(message, 'References').split(/\s+/),
        });
        if (threadConvo) {
          threadConvos[message.threadId] = threadConvo;
        }
      }
      let duplicateConvo = null;
      if (!threadConvo && fromEmail) {
        // Fresh database check so two overlapping syncs can't import the same
        // thread twice, and so an exact re-send of identical content merges
        // into the original. Distinct content is a separate matter.
        const senderConvos = await base44.entities.Conversation.filter(
          { restaurant_id: restaurantId, customer_email: from.email },
          null,
          100
        );
        threadConvo =
          senderConvos.find(
            (c) => c.source === 'Gmail' && !c.is_demo && c.gmail_thread_id === message.threadId
          ) || null;
        if (threadConvo) {
          threadConvos[message.threadId] = threadConvo;
        } else {
          duplicateConvo = findDuplicateConversation(senderConvos, {
            senderEmail: fromEmail,
            subject,
            body,
          });
        }
      }

      if (!threadConvo && !duplicateConvo) {
        // Fresh check: a concurrent or retried sync may have imported this
        // exact message since the snapshot was loaded
        const alreadyImported = await base44.entities.ConversationMessage.filter(
          { gmail_message_id: message.id },
          null,
          1
        );
        if (alreadyImported.length) {
          seenMessageIds.add(message.id);
          continue;
        }
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

        // Store the message linked to its conversation
        await base44.entities.ConversationMessage.create({
          restaurant_id: restaurantId,
          conversation_id: convo.id,
          gmail_message_id: message.id,
          gmail_rfc_id: getHeader(message, 'Message-ID'),
          sender_name: from.name,
          sender_email: from.email,
          body: body.slice(0, 10000),
          received_at: receivedAt,
        });
        await base44.entities.Activity.create({
          restaurant_id: restaurantId,
          opportunity_id: '',
          conversation_id: convo.id,
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
      } else {
        const target = threadConvo || duplicateConvo;
        // Attach the message to the existing conversation (reply or duplicate)
        await base44.entities.ConversationMessage.create({
          restaurant_id: restaurantId,
          conversation_id: target.id,
          gmail_message_id: message.id,
          gmail_rfc_id: getHeader(message, 'Message-ID'),
          sender_name: from.name,
          sender_email: from.email,
          body: body.slice(0, 10000),
          received_at: receivedAt,
        });

        if (threadConvo) {
          // Existing thread: attach the reply, don't duplicate the conversation.
          // Inbox status is separate from the opportunity lifecycle — a new
          // customer reply makes the message New again until reviewed.
          await base44.entities.Conversation.update(threadConvo.id, { status: 'New' });

          // A new customer message on a thread whose opportunity was resolved
          // reopens the matter — it is not finished after all
          const threadOpp = threadConvo.opportunity_id
            ? opps.find((o) => o.id === threadConvo.opportunity_id)
            : null;
          if (threadOpp && threadOpp.status === 'Resolved') {
            await base44.entities.Opportunity.update(threadOpp.id, { status: 'In Progress' });
            await base44.entities.Activity.create({
              restaurant_id: restaurantId,
              opportunity_id: threadOpp.id,
              conversation_id: threadConvo.id,
              type: 'opportunity_reopened',
              description: `New customer message received — Opportunity reopened: ${threadOpp.title}`,
            });
            summary.reopened++;
          }

          // A follow-up in an existing thread re-enters the Inbox as New and is
          // re-analyzed below: the customer's new intent may deserve a fresh
          // draft, a linked follow-up, or a new opportunity — while the thread
          // history (ConversationMessage records) stays with this conversation.
          toAnalyze.push({
            convo: threadConvo,
            subject,
            body,
            senderName: from.name,
            senderEmail: from.email,
            receivedAt,
            isThreadReply: true,
          });
        } else {
          // Same email arriving again (re-send, Gmail duplication, transfer retry)
          summary.duplicatesMerged++;
          await base44.entities.Conversation.update(duplicateConvo.id, { status: 'New' });
        }
        await base44.entities.Activity.create({
          restaurant_id: restaurantId,
          opportunity_id: target.opportunity_id || '',
          conversation_id: target.id,
          type: threadConvo ? 'email_received' : 'email_merged',
          description: threadConvo
            ? `Email received: ${subject} from ${from.name}`
            : `Duplicate email from ${from.name} merged into an existing conversation ("${subject}")`,
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

    // Analyze new threads (bounded batch — the rest are picked up on the next
    // sync). Thread follow-ups are analyzed first: a reply in an existing
    // conversation would otherwise never be re-picked-up by a later sync.
    const analyzeOrder = [...toAnalyze].sort(
      (a, b) => (b.isThreadReply ? 1 : 0) - (a.isThreadReply ? 1 : 0)
    );
    for (const item of analyzeOrder.slice(0, MAX_ANALYZE)) {
      summary.analyzed++;
      // A follow-up in an existing thread: the conversation now shows the new
      // message, and the reply workflow is available again for it.
      const threadExtras = item.isThreadReply
        ? {
            message: item.body.slice(0, 4000),
            received_at: item.receivedAt,
            reply_status: 'Not replied',
            replied_at: null,
          }
        : {};
      let analysis;
      try {
        analysis = await analyzeEmail(base44, restaurant.name || 'the restaurant', {
          senderName: item.senderName,
          senderEmail: item.senderEmail,
          subject: item.subject,
          body: item.body,
        }, {
          knowledgeContext,
          corrections,
        });
      } catch (e) {
        // Analysis failed — keep the email visible and flag it for manual review
        await base44.entities.Conversation.update(item.convo.id, {
          analysis_status: 'Needs review',
          status: 'New',
        });
        summary.needsReview++;
        continue;
      }

      const classification = analysis.classification || 'routine';
      if (classification === 'opportunity') {
        // A follow-up that arrived INSIDE an existing Gmail thread continues
        // that thread's own matter: link it to this conversation's opportunity
        // (reopening it if resolved). A separate email from the same sender is
        // a separate matter and gets its own opportunity — never linked by sender.
        const threadOpp = item.isThreadReply && item.convo.opportunity_id
          ? opps.find((o) => o.id === item.convo.opportunity_id)
          : null;
        if (threadOpp) {
          const reopened = await linkFollowup(base44, {
            restaurantId,
            opportunity: threadOpp,
            customerName: item.senderName,
            priority: analysis.priority,
            conversationId: item.convo.id,
          });
          await base44.entities.Conversation.update(item.convo.id, {
            ...conversationUpdatesFor('opportunity', analysis),
            ...threadExtras,
          });
          summary.followupsLinked++;
          if (reopened) summary.reopened++;
          continue;
        }
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
          status: 'New',
          draft_status: 'Draft',
          recommended_action: analysis.recommended_action || 'Review and respond to this inquiry',
          source: 'Gmail',
          original_message: originalMessage.slice(0, 8000),
          why_identified:
            [analysis.customer_facts, analysis.relay_assessment, analysis.knowledge_used].filter(Boolean).join(' ') +
            ` Relay flagged this with ${analysis.confidence || 'Medium'} confidence.`,
          draft_response: analysis.draft_response || '',
          is_demo: false,
        });
        opps.push(opp);

        await base44.entities.Conversation.update(item.convo.id, {
          opportunity_id: opp.id,
          ...conversationUpdatesFor('opportunity', analysis),
          ...threadExtras,
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
          conversation_id: item.convo.id,
          type: 'opportunity_identified',
          description: `Opportunity identified: ${opp.title} from ${item.senderName} (Gmail)`,
        });
        if (analysis.draft_response) {
          await base44.entities.Activity.create({
            restaurant_id: restaurantId,
            opportunity_id: opp.id,
            conversation_id: item.convo.id,
            type: 'draft_prepared',
            description: `Draft response created for ${item.senderName}'s ${oppType.toLowerCase()}`,
          });
        }
        summary.opportunitiesCreated++;
      } else {
        const outcome = conversationUpdatesFor(classification, analysis);
        await base44.entities.Conversation.update(item.convo.id, {
          ...outcome,
          ...threadExtras,
        });
        if (classification === 'attention') summary.attentionFlagged++;

        // Nothing else to do: a separate email from the same sender (e.g. a
        // job application follow-up Gmail filed as its own thread) stays its
        // own conversation — sender similarity is never a relationship.
      }
    }

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}