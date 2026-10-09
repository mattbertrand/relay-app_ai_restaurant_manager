// Records a follow-up's email as sent IN RELAY ONLY. No external email is
// transmitted — the manager sent it themselves from their own inbox, and
// Relay records that it happened: recipients, cc/bcc, subject, body,
// timestamp, and an Activity History entry that says exactly that. Relay
// never calls a Gmail (or any other) sending API.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanAddressList(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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

    const payload = await req.json().catch(() => ({}));
    const taskId = String(payload.task_id || "");
    const subject = String(payload.subject || "").trim().slice(0, 200);
    const body = String(payload.body || "").slice(0, 20000);
    if (!taskId) return Response.json({ error: 'Which follow-up is this email for?' }, { status: 400 });
    if (!subject) return Response.json({ error: 'Add a subject before recording the email as sent.' }, { status: 400 });

    // To recipients: either the new structured list or the older single
    // recipient fields. Every recipient needs a real address — Relay never
    // invents one.
    let recipients = Array.isArray(payload.recipients)
      ? payload.recipients.map((r) => ({
          name: String((r && r.name) || "").trim().slice(0, 120),
          email: String((r && r.email) || "").trim().slice(0, 200),
        }))
      : cleanAddressList(payload.to_email).map((email, i) => ({
          name: cleanAddressList(payload.to_name)[i] || "",
          email,
        }));
    recipients = recipients.filter((r) => r.email);
    if (recipients.length === 0 || recipients.some((r) => !EMAIL_RE.test(r.email))) {
      return Response.json(
        { error: "A real recipient email address is required — Relay doesn't invent addresses." },
        { status: 400 }
      );
    }

    const ccEmails = cleanAddressList(payload.cc).slice(0, 50);
    const bccEmails = cleanAddressList(payload.bcc).slice(0, 50);
    if ([...ccEmails, ...bccEmails].some((e) => !EMAIL_RE.test(e))) {
      return Response.json(
        { error: "Every cc/bcc address must be a real email address — Relay doesn't invent addresses." },
        { status: 400 }
      );
    }

    const task = await base44.entities.Task.get(taskId).catch(() => null);
    if (!task || task.restaurant_id !== restaurantId) {
      return Response.json({ error: 'Follow-up not found.' }, { status: 404 });
    }

    const toNames = recipients.map((r) => r.name || r.email);
    const toEmails = recipients.map((r) => r.email);
    const patch = {
      draft_recipient: toNames.join(", ") || task.draft_recipient || "",
      draft_recipient_email: toEmails.join(", "),
      draft_cc: ccEmails.join(", "),
      draft_bcc: bccEmails.join(", "),
      draft_subject: subject,
      draft_email: body,
      draft_edited: true,
      email_recorded_sent: true,
      email_recorded_at: new Date().toISOString(),
      email_recorded_to: toNames.join(", "),
      email_recorded_to_email: toEmails.join(", "),
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
      description: `Email recorded as sent in Relay — no external email was sent. To: ${toNames
        .map((n, i) => `${n} <${toEmails[i]}>`)
        .join(", ")}.${ccEmails.length ? ` Cc: ${ccEmails.join(", ")}.` : ""}${
        bccEmails.length ? ` Bcc: ${bccEmails.join(", ")}.` : ""
      } Subject: "${subject}". Follow-up: "${task.title}".`,
      is_demo: /demo/i.test(task.source_label || "") || false,
    });

    return Response.json({ ok: true, task: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}