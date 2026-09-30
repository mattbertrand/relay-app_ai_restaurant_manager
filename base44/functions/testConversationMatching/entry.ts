import { matchExistingConversation } from "../../shared/threadMatching.ts";
import { findDuplicateConversation, bodySimilarity } from "../../shared/dedupe.ts";

// Regression tests for conversation matching. The core rule: the same sender
// is NEVER enough to connect two emails — only Gmail thread identity (thread
// ID, In-Reply-To, References) or an exact re-send of identical content can.
// v2: similarity threshold debugging.
export default async function(req) {
  const results = [];
  const check = (name, pass, detail = '') =>
    results.push({ name, pass: !!pass, detail });

  const SENDER = 'matt@test.com';
  const now = new Date().toISOString();

  // Existing state: one reservation matter and one job application thread.
  const convos = [
    {
      id: 'c1', source: 'Gmail', is_demo: false, customer_email: SENDER,
      subject: 'Reservation for Sunday 10/3',
      message: "Hi, I'd like a reservation for Sunday 10/3 at 6 PM for 4 people.",
      gmail_thread_id: 't1', received_at: now,
    },
    {
      id: 'c2', source: 'Gmail', is_demo: false, customer_email: 'jobs@test.com',
      subject: 'Server position application',
      message: "I'm applying for the server position. Resume attached.",
      gmail_thread_id: 'tj', received_at: now,
    },
  ];
  const rfcIndex = { '<rfc-c1-1>': 'c1', '<rfc-c2-1>': 'c2' };

  // Test A — same sender, different reservation, no Gmail relationship
  const a = matchExistingConversation({ convos, rfcToConversationId: {}, threadId: 'tA', inReplyTo: '', references: [] });
  check('A: same sender, different reservation → separate conversation', !a);
  const aDup = findDuplicateConversation(convos, {
    senderEmail: SENDER,
    subject: 'Reservation for Thanksgiving',
    body: "Hi, we'd like a reservation for Thanksgiving for 12 people.",
  });
  check('A: not merged as a duplicate', !aDup);

  // Test B — same sender AND same subject, different details
  const bConvos = [
    {
      id: 'b1', source: 'Gmail', is_demo: false, customer_email: SENDER,
      subject: 'Reservation',
      message: 'Reservation — 4 people at 6 PM.',
      gmail_thread_id: 'tb1', received_at: now,
    },
  ];
  const b = matchExistingConversation({ convos: bConvos, rfcToConversationId: {}, threadId: 'tb2', inReplyTo: '', references: [] });
  check('B: same subject, different details → separate conversation', !b);
  const bDup = findDuplicateConversation(bConvos, {
    senderEmail: SENDER,
    subject: 'Reservation',
    body: 'Reservation — 8 people at 7 PM.',
  });
  check(
    'B: not merged as a duplicate',
    !bDup,
    `similarity=${bodySimilarity(bConvos[0].message, 'Reservation — 8 people at 7 PM.')}`
  );

  // Test C — genuine reply: Gmail thread ID, and In-Reply-To with a fresh thread ID
  const cThread = matchExistingConversation({ convos, rfcToConversationId: rfcIndex, threadId: 't1', inReplyTo: '', references: [] });
  check('C: Gmail thread ID match joins the original conversation', cThread && cThread.id === 'c1');
  const cReply = matchExistingConversation({ convos, rfcToConversationId: rfcIndex, threadId: 'tC-new', inReplyTo: '<rfc-c1-1>', references: '<rfc-c1-1>' });
  check('C: reply (In-Reply-To) joins the original conversation', cReply && cReply.id === 'c1');

  // Test D — job application follow-up inside the same Gmail thread
  const d = matchExistingConversation({ convos, rfcToConversationId: rfcIndex, threadId: 'tj', inReplyTo: '<rfc-c2-1>', references: '<rfc-c2-1>' });
  check('D: job application follow-up stays in the same conversation', d && d.id === 'c2');

  // Test E — same sender, unrelated inquiry in a different thread
  const e = matchExistingConversation({ convos, rfcToConversationId: rfcIndex, threadId: 'tE', inReplyTo: '', references: [] });
  check('E: unrelated inquiry from the same sender → separate conversation', !e);

  // Test F — two similar reservations from the same sender, separate Gmail
  // threads: similar wording and the same subject must NOT merge them. If
  // Gmail filed them in the same thread, they stay one conversation.
  const fConvos = [
    {
      id: 'f1', source: 'Gmail', is_demo: false, customer_email: SENDER,
      subject: 'Reservation',
      message: 'Hello, I need to make a reservation on Tuesday at 9am.',
      gmail_thread_id: 'tf1', received_at: now,
    },
    {
      id: 'f2', source: 'Gmail', is_demo: false, customer_email: SENDER,
      subject: 'Reservation',
      message: 'Hello, I need to make a reservation for 8 people for Tuesday 9/31 at 1pm.',
      gmail_thread_id: 'tf2', received_at: now,
    },
  ];
  // A NEW message from the same sender in a fresh Gmail thread (tf3): no
  // thread identity, no reply headers → never linked to either reservation.
  const fSeparate = matchExistingConversation({ convos: fConvos, rfcToConversationId: {}, threadId: 'tf3', inReplyTo: '', references: [] });
  check('F: similar reservations, separate Gmail threads → separate conversations', !fSeparate);
  const fLinked = matchExistingConversation({ convos: fConvos, rfcToConversationId: {}, threadId: 'tf1', inReplyTo: '', references: [] });
  check('F: a message in an existing Gmail thread joins its own conversation', fLinked && fLinked.id === 'f1');
  const fDup = findDuplicateConversation([fConvos[0]], { senderEmail: SENDER, subject: 'Reservation', body: fConvos[1].message });
  check(
    'F: similar wording from the same sender is not a duplicate merge',
    !fDup,
    `similarity=${bodySimilarity(fConvos[0].message, fConvos[1].message)}`
  );

  // Safety net — an exact re-send of identical content IS a duplicate
  const resend = findDuplicateConversation(convos, {
    senderEmail: SENDER,
    subject: 'Reservation for Sunday 10/3',
    body: "Hi, I'd like a reservation for Sunday 10/3 at 6 PM for 4 people.",
  });
  check('Safety: exact re-send of identical content merges into the original', !!resend && resend.id === 'c1');

  const passed = results.every((r) => r.pass);
  return Response.json({ passed, results });
}