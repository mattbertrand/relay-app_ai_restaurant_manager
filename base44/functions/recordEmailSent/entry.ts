// Records a follow-up's email as sent IN RELAY ONLY. No external email is
// transmitted — the manager sent it themselves from their own inbox, and
// Relay records that it happened: recipient, subject, body, timestamp, and
// an Activity History entry that says exactly that. Relay never calls a
// Gmail (or any other) sending API.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const restaurantId = user.restaurant_id || (user.data && user.data.restaurant_id);
    if (!restaurantId) {
      return Response.json({ error: 'No restaurant is set up for this account yet.' }, { status: 400 });
    }

    const payload = await req.json().catch(() => ({}));
    const taskId = String(payload.task_id || "");
    const toName = String(payload.to_name || "").trim().slice(0, 120);
    const toEmail = String(payload.to_email || "").trim().slice(0, 200);
    const subject = String(payload.subject || "").trim().slice(0, 200);
    const body = String(payload.body || "").slice(0, 20000);
    if (!taskId) return Response.json({ error: 'Which follow-up is this email for?' }, { status: 400 });
    if (!EMAIL_RE.test(toEmail)) {
      return Response.json(
        { error: "A real recipient email address is required — Relay doesn't invent addresses." },
        { status: 400 }
      );
    }
    if (!subject) return Response.json({ error: 'Add a subject before recording the email as sent.' }, { status: 400 });

    const task = await base44.entities.Task.get(taskId).catch(() => null);
    if (!task || task.restaurant_id !== restaurantId) {
      return Response.json({ error: 'Follow-up not found.' }, { status: 404 });
    }

    const patch = {
      draft_recipient: toName || task.draft_recipient || "",
      draft_recipient_email: toEmail,
      draft_subject: subject,
      draft_email: body,
      draft_edited: true,
      email_recorded_sent: true,
      email_recorded_at: new Date().toISOString(),
      email_recorded_to: toName || task.draft_recipient || "",
      email_recorded_to_email: toEmail,
      email_recorded_subject: subject,
    };
    const updated = await base44.entities.Task.update(task.id, patch);

    // Activity History, scoped to the task's source item — with language that
    // never claims an external email was sent.
    const actSource = {};
    if (task.source_type === "review" && task.source_id) actSource.review_id = task.source_id;
    else if (task.source_type === "email" && task.source_id) actSource.conversation_id = task.source_id;
    else if (task.source_type === "opportunity" && task.source_id) actSource.opportunity_id = task.source_id;
    await base44.entities.Activity.create({
      restaurant_id: restaurantId,
      ...actSource,
      type: "email_recorded_sent",
      description: `Email recorded as sent in Relay — no external email was sent. To: ${patch.email_recorded_to || "recipient"} <${toEmail}>. Subject: "${subject}". Follow-up: "${task.title}".`,
      is_demo: /demo/i.test(task.source_label || "") || false,
    });

    return Response.json({ ok: true, task: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}