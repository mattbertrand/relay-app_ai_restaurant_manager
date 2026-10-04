import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import {
  GMAIL_CONNECTOR_ID,
  getGmailProfile,
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
  formatAdminContextForPrompt,
  formatCorrectionsForPrompt,
  formatResponseTemplatesForPrompt,
} from "../../shared/restaurantKnowledge.ts";
import { reprocessConversations } from "../../shared/reprocessConversations.ts";
import { calendarAnalysisContext } from "../../shared/calendarSchedule.ts";

// Gmail sync for Relay — imports new mail, classifies it, and supports reprocessing.
const MAX_MESSAGES = 20;
const MAX_ANALYZE = 6;

// The UTC timestamp of local midnight "today" in an IANA timezone — what
// "Today" means for the initial import (the current calendar day, never the
// last 24 hours). Falls back to UTC when no timezone is configured.
function localMidnightMs(timezone) {
  const tz = timezone || "UTC";
  const dateStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  let t = new Date(`${dateStr}T00:00:00Z`).getTime();
  for (let i = 0; i < 3; i++) {
    const parts = {};
    for (const { type, value } of new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(t))) {
      parts[type] = value;
    }
    const asUTC = new Date(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}:${parts.second}Z`
    ).getTime();
    if (!asUTC) break;
    t += t - asUTC;
  }
  return t;
}

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

    // CONNECTION AND SYNCHRONIZATION ARE SEPARATE EVENTS. A Gmail account
    // that has never had an explicit initial synchronization — the manager's
    // Communication → Sync choice of how much history to import — is imported
    // ONLY by that explicit initial import. Never by opening the Inbox, a
    // reconnect, returning from OAuth, or any routine sync call. This guard
    // is the single place that stops an uninitialized connection from
    // silently ingesting mail.
    const payload = await req.json().catch(() => ({}));
    const isBackfill = payload.initial_import === true;
    let gmailSetup = restaurant.gmail_setup && typeof restaurant.gmail_setup === "object" ? { ...restaurant.gmail_setup } : null;
    if (!isBackfill && !(gmailSetup && gmailSetup.completed_at)) {
      return Response.json({
        connected: true,
        initialized: false,
        gmail_setup: gmailSetup,
        newMessages: 0,
        analyzed: 0,
      });
    }

    // Verified restaurant knowledge and this restaurant's manager corrections
    // steer the analysis: facts the manager entered are authoritative, and a
    // rule learned from one restaurant never affects another restaurant.
    // Loaded before the backfill window is computed — the restaurant's
    // timezone defines what "Today" means for the initial import.
    const [knowledgeRecord, feedback] = await Promise.all([
      loadKnowledge(base44, restaurantId),
      loadRecentFeedback(base44, restaurantId),
    ]);

    // Initial-import configuration — the manager's choice of how much
    // existing email to analyze when Gmail is first connected. Stored on this
    // restaurant's record only; it controls the initial backfill exclusively
    // and is never applied as a permanent Gmail filter.
    let backfillActive = false;
    let windowStartMs = null;

    if (isBackfill) {
      if (gmailSetup && gmailSetup.completed_at) {
        return Response.json({ connected: true, initial_import: { done: true, window: gmailSetup.window || null } });
      }
      const chosenWindow = ["now", "7d", "30d", "custom"].includes(payload.window)
        ? payload.window
        : (gmailSetup && gmailSetup.window) || null;
      if (!chosenWindow) {
        return Response.json({ error: "Choose how much email Relay should analyze." }, { status: 400 });
      }
      const fromDate = chosenWindow === "custom"
        ? String(payload.from_date || (gmailSetup && gmailSetup.from_date) || "")
        : "";
      if (chosenWindow === "custom" && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
        return Response.json({ error: "Choose a valid date for the initial import." }, { status: 400 });
      }
      gmailSetup = {
        ...gmailSetup,
        window: chosenWindow,
        from_date: chosenWindow === "custom" ? fromDate : null,
        selected_at: new Date().toISOString(),
        completed_at: null,
      };
      await base44.entities.Restaurant.update(restaurantId, { gmail_setup: gmailSetup });
      // "Today" means the current calendar day — from local midnight in the
      // restaurant's timezone to now — never the last 24 hours. The backfill
      // matches each message's own received timestamp, so a brand-new message
      // in a months-old Gmail thread is still included.
      backfillActive = true;
      windowStartMs =
        chosenWindow === "now" ? localMidnightMs(knowledgeRecord ? knowledgeRecord.timezone : null) :
        chosenWindow === "7d" ? Date.now() - 7 * 24 * 60 * 60 * 1000 :
        chosenWindow === "30d" ? Date.now() - 30 * 24 * 60 * 60 * 1000 :
        new Date(`${fromDate}T00:00:00Z`).getTime();
    }
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
    if (payload.reprocess) {
      const reprocessSummary = await reprocessConversations({
        base44,
        restaurantId,
        restaurantName: restaurant.name || 'the restaurant',
        restaurantEmail: restaurant.email || '',
        convos,
        messages: existingMsgs,
      });
      return Response.json(reprocessSummary);
    }

    // The backfill query matches each message's OWN received date (Gmail
    // `after:`), so a brand-new message in a months-old thread is still
    // included. Ongoing monitoring keeps its standard recent-mail query —
    // the initial-import window never becomes a permanent filter.
    let gmailMessages = [];
    let listPageToken = null;
    if (backfillActive) {
      let fetchToken = null;
      do {
        const page = await listInboxMessages(accessToken, 50, {
          afterEpochSeconds: Math.floor(windowStartMs / 1000),
          pageToken: fetchToken,
        });
        gmailMessages = gmailMessages.concat(page.messages);
        fetchToken = page.nextPageToken || null;
      } while (fetchToken && gmailMessages.length < 100);
      listPageToken = fetchToken;
    } else {
      const page = await listInboxMessages(accessToken, 25);
      gmailMessages = page.messages;
    }
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
    const maxMessages = backfillActive ? 30 : MAX_MESSAGES;

    const toAnalyze = [];
    // The restaurant's own mail — both the configured restaurant address and
    // the connected Gmail account itself — is never imported or analyzed. This
    // keeps the manager's own outbound replies out of the inbox and out of
    // re-analysis, so the customer's identity always comes from the incoming
    // message, never from a restaurant-side sender.
    let gmailAddress = null;
    try {
      gmailAddress = await getGmailProfile(accessToken);
    } catch (e) {
      // Profile lookup is best-effort; the restaurant's configured address still applies.
    }
    const ownEmails = [restaurant.email, gmailAddress]
      .map((e) => (e || '').toLowerCase())
      .filter(Boolean);

    const oldestFirst = [...gmailMessages].reverse();
    let hitCap = false;
    for (const gm of oldestFirst) {
      if (seenMessageIds.has(gm.id)) continue;
      if (summary.newMessages >= maxMessages) { hitCap = true; break; }

      let message;
      try {
        message = await fetchMessage(accessToken, gm.id);
      } catch (e) {
        continue;
      }

      // Message-level label check: a search result can still surface a
      // message the user deleted or archived (e.g. moved to Trash between
      // listing and fetch). Only messages actually in the Inbox are imported.
      const labels = (message.labelIds || []).map((l) => String(l).toUpperCase());
      if (labels.includes('TRASH') || labels.includes('SPAM') || !labels.includes('INBOX')) continue;

      const from = parseFromAddress(getHeader(message, 'From'));
      const fromEmail = (from.email || '').toLowerCase();
      const subject = getHeader(message, 'Subject') || '(no subject)';
      const body = extractTextBody(message.payload);
      // The import window is enforced per message received timestamp —
      // never by the age of the Gmail thread a message belongs to.
      const receivedAtMs = message.internalDate ? Number(message.internalDate) : Date.now();
      if (backfillActive && receivedAtMs < windowStartMs) continue;
      const receivedAt = new Date(receivedAtMs).toISOString();
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
          type: backfillActive ? 'email_imported' : 'email_received',
          description: backfillActive
            ? `Email imported (initial history): ${subject} from ${from.name}`
            : `Email received: ${subject} from ${from.name}`,
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
          type: threadConvo ? (backfillActive ? 'email_imported' : 'email_received') : 'email_merged',
          description: threadConvo
            ? (backfillActive
                ? `Email imported (initial history): ${subject} from ${from.name}`
                : `Email received: ${subject} from ${from.name}`)
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
          adminContext: formatAdminContextForPrompt(knowledgeRecord, {
            senderEmail: item.senderEmail,
            subject: item.subject,
            body: item.body,
          }),
          corrections,
          templatesContext: formatResponseTemplatesForPrompt(knowledgeRecord),
          calendarContext: await calendarAnalysisContext(base44, knowledgeRecord, item.subject, item.body),
          timezone: knowledgeRecord ? knowledgeRecord.timezone : null,
          signature: knowledgeRecord && knowledgeRecord.email_signature ? knowledgeRecord.email_signature : null,
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
          last_analyzed_at: new Date().toISOString(),
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

    if (backfillActive) {
      // The backfill is only finished when the Gmail list is exhausted AND
      // every imported conversation has been analyzed; otherwise the caller
      // keeps calling and progress continues where it left off.
      const leftoverToAnalyze = Math.max(0, analyzeOrder.length - MAX_ANALYZE);
      const done = !listPageToken && !hitCap && leftoverToAnalyze === 0;
      if (done && gmailSetup && !gmailSetup.completed_at) {
        gmailSetup = { ...gmailSetup, completed_at: new Date().toISOString() };
        await base44.entities.Restaurant.update(restaurantId, { gmail_setup: gmailSetup });
      }
      summary.initial_import = { window: gmailSetup ? gmailSetup.window : null, done, remaining: !done };
    }

    // Record the successful sync time — the Communication page shows
    // "Last synced" from it. Best-effort; never fails the sync.
    if (gmailSetup) {
      try {
        await base44.entities.Restaurant.update(restaurantId, {
          gmail_setup: { ...gmailSetup, last_sync_at: new Date().toISOString() },
        });
      } catch (e) { /* best effort */ }
    }

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}