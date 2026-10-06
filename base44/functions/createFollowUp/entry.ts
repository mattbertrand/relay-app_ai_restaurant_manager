// Creates or updates a follow-up task from the manager's natural-language
// instruction, given right after a meaningful Relay action (publishing a
// review response, recording an email reply, moving an opportunity to In
// Progress). One LLM call turns the instruction into a single task; dates are
// resolved only when the manager actually gave one — an explicit chip choice
// (ASAP / Today / This week / …) always wins over inference — contextual
// triggers ("when John gets here") are preserved as words — never converted
// into a fake date — and an instruction that clearly refers to an existing
// open task for the same item UPDATES that task instead of creating a
// duplicate. Email follow-ups get a real draft built from the manager's
// instruction, the source item, and the Restaurant Profile — saved in Relay
// only, never sent automatically.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { loadKnowledge, formatKnowledgeForPrompt } from "../../shared/restaurantKnowledge.ts";
import { loadSourceContext } from "../../shared/taskSourceContext.ts";
import { finalizeDraft } from "../../shared/signature.ts";

const TASK_TYPES = [
  "Follow up", "Call", "Email", "Discuss", "Investigate", "Check",
  "Meeting", "Customer follow-up", "Internal follow-up", "Other",
];

// The quick action choices the manager picks from after a meaningful action.
// The chip is the manager's explicit intent; the instruction stays the source
// of truth for the wording.
const ACTION_TYPE_MAP = {
  talk: "Discuss",
  call: "Call",
  email: "Email",
  investigate: "Investigate",
  customer: "Customer follow-up",
  meeting: "Meeting",
  other: "Other",
};

const PARSE_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["create_task", "update_task", "no_task"] },
    existing_task_id: { type: "string", description: "For update_task: the id of the existing task this instruction refers to." },
    title: { type: "string", description: "Short, specific task title." },
    task_type: { type: "string", enum: TASK_TYPES },
    priority: { type: "string", enum: ["High", "Normal", "Low"] },
    due_date: { type: "string", description: "YYYY-MM-DD when the manager gave (or clearly implied) a date; empty otherwise." },
    due_time: { type: "string", description: "HH:mm (24h) when a time was said or clearly implied; empty otherwise." },
    reminder_note: { type: "string", description: "The manager's own contextual trigger words, when the timing is a real-world condition rather than a date (e.g. 'when John gets here'). Empty otherwise." },
    needs_clarification: { type: "boolean", description: "True when the timing is a real-world trigger Relay cannot schedule and the manager must be asked when to remind them." },
    clarification_question: { type: "string" },
    draft_requested: { type: "boolean", description: "True when the manager asks to email/message someone in the future." },
    draft_recipient: { type: "string", description: "Who the email goes to — a person, role, or team (e.g. 'Banquet Manager', 'the owner')." },
    draft_subject: { type: "string" },
    draft_body: { type: "string", description: "Short polite plain-text draft the manager can edit. Saved in Relay only, never sent." },
  },
  required: ["intent"],
};

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string", description: "Short, specific email subject." },
    body: { type: "string", description: "The email body — greeting, 1-3 short paragraphs, closing line. No signature." },
  },
  required: ["subject", "body"],
};

// Restaurant-local wall time → UTC ISO instant (DST-safe, two-pass offset).
function zonedToUtcIso(dateStr, timeStr, tz) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return null;
  let time = String(timeStr || "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(time)) time = "09:00";
  else if (time.length === 4) time = "0" + time;
  const naive = Date.parse(`${dateStr}T${time}:00Z`);
  if (isNaN(naive)) return null;
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  let ts = naive;
  for (let i = 0; i < 2; i++) {
    const parts = {};
    for (const p of dtf.formatToParts(new Date(ts))) {
      if (p.type !== "literal") parts[p.type] = p.value;
    }
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
    // Offset is computed from the current GUESS (ts), not from naive — two
    // passes converge on the true UTC instant for the restaurant's wall time.
    ts = naive + (ts - asUtc);
  }
  return new Date(ts).toISOString();
}

function todayIn(tz) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}

function weekdayOf(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
}

function addDaysIso(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Builds the email draft for a follow-up: the manager's instruction is the
// source of truth; the source item and the verified Restaurant Profile add
// the facts. Exactly one signature block is appended (rich HTML signature
// kept as HTML). Relay never sends the result.
async function buildDraft(base44, restaurantId, { recipient, topic, sourceType, sourceId, sourceLabel, sourceSummary }) {
  const [knowledge, restaurant] = await Promise.all([
    loadKnowledge(base44, restaurantId),
    base44.entities.Restaurant.get(restaurantId).catch(() => null),
  ]);
  const restaurantName = (restaurant && restaurant.name) || "the restaurant";
  const knowledgeBlock = knowledge ? formatKnowledgeForPrompt(knowledge) || "(none entered yet)" : "(none entered yet)";
  const sourceBlock = await loadSourceContext(base44, restaurantId, sourceType, sourceId) ||
    (sourceSummary ? `About the item: ${sourceSummary}` : "(no source context)");

  const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You write ONE email draft that a restaurant manager will review, edit, and send LATER from their own inbox. The draft is saved in Relay only.

RECIPIENT: ${recipient || "(unknown — use a neutral greeting; the manager will fill in the recipient)"}

What the manager wants this email to do (their own words — the source of truth):
"${topic}"

The Relay item this follow-up came from:
${sourceBlock}

Verified restaurant facts you may use (never invent anything beyond these):
${knowledgeBlock}

Rules:
- Greet the RECIPIENT above — never the restaurant's manager or owner. Use [Name] when a specific person's name is unknown (e.g. "Hi [Name],").
- 1 to 3 short, concrete paragraphs. Real line breaks, greeting on its own line. Reference the item context where it helps the recipient understand why they are being emailed.
- Never confirm a booking, price, availability, or commitment the verified facts don't support. Where a fact is missing, say the manager will follow up.
- Do NOT write a signature block, sender name, restaurant name, or contact details at the end — Relay appends the manager's configured signature automatically. End with the closing line only (e.g. "Best,").

Return JSON only.`,
    response_json_schema: DRAFT_SCHEMA,
  });

  const body = finalizeDraft(
    llm.body || "",
    (knowledge && knowledge.signature_text) || "",
    (knowledge && knowledge.signature_html) || "",
    restaurantName
  );
  return { subject: String(llm.subject || "").slice(0, 200), body: String(body).slice(0, 5000) };
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
    const knowledge = await loadKnowledge(base44, restaurantId);
    const tz = (knowledge && knowledge.timezone) || "America/Los_Angeles";

    // Draft regeneration: an explicit manager action on an existing task —
    // rebuilds the draft from the task's own instruction and source context.
    if (payload.task_id && payload.regenerate_draft) {
      const task = await base44.entities.Task.get(payload.task_id).catch(() => null);
      if (!task || task.restaurant_id !== restaurantId) {
        return Response.json({ error: 'Task not found.' }, { status: 404 });
      }
      if (!["email", "review", "opportunity"].includes(task.source_type) || !task.source_id) {
        return Response.json({ error: 'This task has no source item to draft from.' }, { status: 400 });
      }
      const draft = await buildDraft(base44, restaurantId, {
        recipient: String(payload.recipient || task.draft_recipient || "").slice(0, 120),
        topic: task.description || task.title,
        sourceType: task.source_type,
        sourceId: task.source_id,
        sourceLabel: task.source_label,
        sourceSummary: "",
      });
      const patch = {
        draft_email: draft.body,
        draft_subject: draft.subject,
        draft_recipient: String(payload.recipient || task.draft_recipient || "").slice(0, 120),
        draft_edited: false,
      };
      const updated = await base44.entities.Task.update(task.id, patch);
      const actSource = task.source_type === "review"
        ? { review_id: task.source_id }
        : task.source_type === "email"
        ? { conversation_id: task.source_id }
        : task.source_type === "opportunity"
        ? { opportunity_id: task.source_id }
        : {};
      await base44.entities.Activity.create({
        restaurant_id: restaurantId,
        ...actSource,
        type: "task_updated",
        description: `Email draft regenerated for "${task.title}" — saved in Relay only, nothing sent.`,
        is_demo: task.source_label ? /demo/i.test(task.source_label) : false,
      });
      return Response.json({ ok: true, task: updated });
    }

    // Clarification answer: attach a real reminder time to an existing task
    // whose timing was a real-world trigger Relay cannot detect.
    if (payload.task_id) {
      const task = await base44.entities.Task.get(payload.task_id).catch(() => null);
      if (!task || task.restaurant_id !== restaurantId) {
        return Response.json({ error: 'Task not found.' }, { status: 404 });
      }
      const patch = {
        due_date: payload.due_date || "",
        due_time: payload.due_time || "",
        snooze_until: "",
      };
      const reminderAt = patch.due_date ? zonedToUtcIso(patch.due_date, patch.due_time, tz) : null;
      if (reminderAt) {
        patch.reminder_at = reminderAt;
        patch.reminder_status = "pending";
        patch.reminder_note = "";
      }
      await base44.entities.Task.update(task.id, patch);
      const when = patch.due_date + (patch.due_time ? ` at ${patch.due_time}` : "");
      const actSource = task.source_type === "review"
        ? { review_id: task.source_id }
        : task.source_type === "email"
        ? { conversation_id: task.source_id }
        : task.source_type === "opportunity"
        ? { opportunity_id: task.source_id }
        : {};
      await base44.entities.Activity.create({
        restaurant_id: restaurantId,
        ...actSource,
        type: "task_updated",
        description: `Reminder set for "${task.title}" — ${when}.`,
        is_demo: task.source_label ? /demo/i.test(task.source_label) : false,
      });
      return Response.json({ ok: true, task: { ...task, ...patch } });
    }

    const instruction = String(payload.instruction || "").trim().slice(0, 500);
    if (!instruction) {
      return Response.json({ error: 'Tell Relay what to follow up on.' }, { status: 400 });
    }
    const sourceType = ["review", "email", "opportunity", "event"].includes(payload.source_type)
      ? payload.source_type
      : "manual";
    const sourceId = String(payload.source_id || "");
    const sourceLabel = String(payload.source_label || "").slice(0, 120);
    const sourceSummary = String(payload.source_summary || "").slice(0, 800);
    const sourceIsDemo = payload.source_is_demo === true;

    // The quick action chip the manager picked — their explicit intent for
    // the task type. Empty when they went straight to free-form input.
    const actionType = ACTION_TYPE_MAP[payload.action_type] || null;
    const recipient = String(payload.recipient || "").trim().slice(0, 120);

    const today = todayIn(tz);
    const tomorrow = addDaysIso(today, 1);

    // Existing OPEN tasks for this same source item — the basis for duplicate
    // prevention ("same instruction again") and for "actually, tomorrow
    // instead" updates. Re-analysis of the source item never creates tasks,
    // so this list stays clean.
    const existingPage = sourceId
      ? await base44.entities.Task.filter(
          { restaurant_id: restaurantId, source_id: sourceId, status: { $in: ["Open", "In Progress"] } },
          { sort: "-created_date", limit: 20 }
        )
      : { items: [] };
    const existing = existingPage.items || [];
    const existingLines = existing.length
      ? existing
          .map((t) => `- id ${t.id}: "${t.title}" (${t.task_type}${t.due_date ? `, due ${t.due_date}${t.due_time ? ` ${t.due_time}` : ""}` : ", no date yet"})`)
          .join("\n")
      : "(none)";

    const sourceContent = await loadSourceContext(base44, restaurantId, sourceType, sourceId);

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You convert a restaurant manager's short follow-up request into ONE follow-up task for Relay, the restaurant's operations assistant.

Today is ${today} (${weekdayOf(today)}) in the restaurant's timezone (${tz}). Tomorrow is ${tomorrow}.

The manager just completed an action on this item in Relay:
Source: ${sourceLabel || sourceType} (${sourceType})
What it is about: ${sourceSummary || "(no extra context)"}
${sourceContent && sourceContent !== "(no source context)" ? `\nThe item itself:\n${sourceContent}` : ""}

${actionType ? `The manager selected "${Object.keys(ACTION_TYPE_MAP).find((k) => ACTION_TYPE_MAP[k] === actionType)}" from a menu of actions — set task_type "${actionType}" unless their instruction clearly describes a different action. Their instruction is the source of truth for what the task should do.` : ""}

The manager now says: "${instruction}"

Existing open follow-up tasks for this same item:
${existingLines}

Rules:
1. Dates. Resolve relative dates against today: "today", "tonight", "this morning/afternoon/evening" (today; afternoon is about 1:00 PM), "tomorrow", "tomorrow morning" (tomorrow, 09:00), a weekday name (the next occurrence — if today IS that weekday, use today), "next Monday" (Monday of next week), "in three days", "this week" (the coming Friday), "next week" (Monday of next week), "asap" (today, and priority High). Output due_date as YYYY-MM-DD and due_time as HH:mm 24h when a time was said or clearly implied ("at 2" or "2pm" → 14:00, "9:30" → 09:30, "this afternoon" → 13:00, "this morning" → 09:00, "end of day" → 17:00, "stand-up meeting" with no stated time → leave the time empty). NEVER invent a date or time the manager did not give. Date only → leave due_time empty.
2. Timing you cannot schedule. Relay cannot detect when a person arrives, when an investigation finishes, or when a delivery shows up. If the manager's timing is a real-world condition — "when John gets here", "after we investigate", "when the delivery arrives" — keep the manager's words in reminder_note, leave due_date and due_time empty, and set needs_clarification=true with clarification_question exactly: "When should I remind you?". Do NOT guess a date.
3. "this" always refers to the item above; the manager never repeats it. Write a short, specific title that names the work, e.g. "Discuss this review at today's stand-up", "Check with the banquet manager", "Follow up with Jane about the private event". If the manager asked to email someone, the title must say "Email ..." — never "Call ..." or anything else.
4. task_type from the list. "Discuss" for bringing something up with the team or at a meeting; "Call" for phone; "Email" for writing to someone later; "Check" for verifying something; "Investigate"; "Meeting"; "Follow up"; "Customer follow-up"; "Internal follow-up"; "Other". priority "High" only for clearly urgent wording ("urgent", "asap", "right away"); "Low" for "whenever you get a chance"; otherwise "Normal".
5. Draft requests. If the manager asks to email/message someone in the future ("email the owner after we investigate this", "email the banquet manager for tentative Dine & Donate"), set task_type "Email" and draft_requested=true. Set draft_recipient to the person, role, or team the email goes to (e.g. "the banquet manager", "the owner"). Write draft_subject plus a short, polite, plain-text draft_body the manager can edit — 1 to 3 short paragraphs, greeting on its own line, addressed to the RECIPIENT (never the customer or the manager), no signature block. Use [Name] placeholders when a name is unknown. The draft is saved in Relay only — it is never sent automatically.
6. Duplicates. If the request clearly refers to an existing open task for this item — the same intent again, or "actually ..." adjusting it ("actually remind me tomorrow instead") — use intent "update_task" with that task's existing_task_id and the corrected details; never create a duplicate. Create a new task only when no existing task matches. If the message contains no follow-up at all (e.g. "no", "thanks"), use intent "no_task".

Return JSON only.`,
      response_json_schema: PARSE_SCHEMA,
    });

    const intent = llm.intent || "create_task";
    if (intent === "no_task") {
      return Response.json({ created_new: false, updated_existing: false, task: null, no_task: true });
    }

    // Structured choices the manager made explicitly — they win over
    // inference. A timeframe chip pins the date; the instruction can still
    // refine the time. "ASAP" is a chip the frontend already resolved to
    // today + priority High before sending.
    const chosenDate = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.due_date || "")) ? payload.due_date : "";
    const chosenTime = /^\d{1,2}:\d{2}$/.test(String(payload.due_time || "")) ? payload.due_time : "";
    const chosenPriority = ["High", "Normal", "Low"].includes(payload.priority) ? payload.priority : null;
    const dueDate = chosenDate || llm.due_date || "";
    const dueTime = chosenDate ? (chosenTime || llm.due_time || "") : llm.due_time || "";
    const priority = chosenPriority || (["High", "Normal", "Low"].includes(llm.priority) ? llm.priority : "Normal");
    const taskType = actionType || (TASK_TYPES.includes(llm.task_type) ? llm.task_type : "Follow up");

    const actSource = {};
    if (sourceType === "review") actSource.review_id = sourceId;
    else if (sourceType === "email") actSource.conversation_id = sourceId;
    else if (sourceType === "opportunity") actSource.opportunity_id = sourceId;

    // Update an existing open task instead of creating a duplicate.
    if (intent === "update_task" && llm.existing_task_id && existing.some((t) => t.id === llm.existing_task_id)) {
      const target = existing.find((t) => t.id === llm.existing_task_id);
      const patch = {
        reminder_note: llm.reminder_note || "",
        snooze_until: "",
      };
      if (llm.title) patch.title = String(llm.title).slice(0, 200);
      if (TASK_TYPES.includes(llm.task_type)) patch.task_type = llm.task_type;
      if (priority) patch.priority = priority;
      if (dueDate) patch.due_date = dueDate;
      if (dueTime) patch.due_time = dueTime;
      if (recipient) patch.draft_recipient = recipient;
      if (llm.draft_requested || (taskType === "Email" && !target.draft_email)) {
        if (!target.draft_edited) {
          const draft = await buildDraft(base44, restaurantId, {
            recipient: recipient || llm.draft_recipient || target.draft_recipient || "",
            topic: instruction,
            sourceType,
            sourceId,
            sourceLabel,
            sourceSummary,
          });
          patch.draft_email = draft.body;
          patch.draft_subject = draft.subject;
          patch.draft_recipient = recipient || llm.draft_recipient || target.draft_recipient || "";
          patch.draft_edited = false;
        }
      }
      if (patch.due_date) {
        const reminderAt = zonedToUtcIso(patch.due_date, patch.due_time || target.due_time || "", tz);
        if (reminderAt) {
          patch.reminder_at = reminderAt;
          patch.reminder_status = "pending";
        }
      }
      const updated = await base44.entities.Task.update(target.id, patch);
      await base44.entities.Activity.create({
        restaurant_id: restaurantId,
        ...actSource,
        type: "task_updated",
        description: `Follow-up updated — "${patch.title || target.title}"${patch.due_date ? `, due ${patch.due_date}${patch.due_time ? ` ${patch.due_time}` : ""}` : ""}.`,
        is_demo: sourceIsDemo,
      });
      return Response.json({ created_new: false, updated_existing: true, task: updated });
    }

    // Email follow-up → build a real draft from the instruction, the source
    // item, and the Restaurant Profile. Saved in Relay only, never sent.
    let draftEmail = "";
    let draftSubject = "";
    const wantsDraft = taskType === "Email" || llm.draft_requested;
    if (wantsDraft) {
      const draft = await buildDraft(base44, restaurantId, {
        recipient: recipient || llm.draft_recipient || "",
        topic: instruction,
        sourceType,
        sourceId,
        sourceLabel,
        sourceSummary,
      });
      draftEmail = draft.body;
      draftSubject = draft.subject;
    }

    // Create the task.
    const title = String(llm.title || "Follow up").slice(0, 200);
    let reminderAt = null;
    let reminderStatus = "none";
    if (dueDate) {
      reminderAt = zonedToUtcIso(dueDate, dueTime, tz);
      if (reminderAt) reminderStatus = "pending";
    }
    const needsClarify = !dueDate && !!llm.needs_clarification;
    const task = await base44.entities.Task.create({
      restaurant_id: restaurantId,
      title,
      description: "",
      task_type: taskType,
      status: "Open",
      priority,
      source_type: sourceType,
      source_id: sourceId,
      source_label: sourceLabel,
      due_date: dueDate,
      due_time: dueTime,
      reminder_at: reminderAt || "",
      reminder_note: llm.reminder_note || "",
      reminder_status: reminderStatus,
      snooze_until: "",
      draft_email: draftEmail,
      draft_subject: draftSubject,
      draft_recipient: recipient || llm.draft_recipient || "",
      created_via: "Follow-up prompt",
    });
    await base44.entities.Activity.create({
      restaurant_id: restaurantId,
      ...actSource,
      type: "task_created",
      description: `Follow-up task created — "${title}"${dueDate ? `, due ${dueDate}${dueTime ? ` ${dueTime}` : ""}` : ""}.`,
      is_demo: sourceIsDemo,
    });
    return Response.json({
      created_new: true,
      updated_existing: false,
      needs_clarification: needsClarify,
      clarification_question: needsClarify
        ? (llm.clarification_question || "When should I remind you?")
        : null,
      task,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}