// Creates or updates a follow-up task from the manager's natural-language
// instruction, given right after a meaningful Relay action (publishing a
// review response, recording an email reply, moving an opportunity to In
// Progress). One LLM call turns the instruction into a single task; dates are
// resolved only when the manager actually gave one, contextual triggers
// ("when John gets here") are preserved as words — never converted into a
// fake date — and an instruction that clearly refers to an existing open
// task for the same item UPDATES that task instead of creating a duplicate.
// Any draft email is stored in Relay only — it is never sent automatically.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { loadKnowledge } from "../../shared/restaurantKnowledge.ts";

const TASK_TYPES = [
  "Follow up", "Call", "Email", "Discuss", "Investigate", "Check",
  "Meeting", "Customer follow-up", "Internal follow-up", "Other",
];

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
    draft_subject: { type: "string" },
    draft_body: { type: "string", description: "Short polite plain-text draft the manager can edit. Saved in Relay only, never sent." },
  },
  required: ["intent"],
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

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You convert a restaurant manager's short follow-up request into ONE follow-up task for Relay, the restaurant's operations assistant.

Today is ${today} (${weekdayOf(today)}) in the restaurant's timezone (${tz}). Tomorrow is ${tomorrow}.

The manager just completed an action on this item in Relay:
Source: ${sourceLabel || sourceType} (${sourceType})
What it is about: ${sourceSummary || "(no extra context)"}

The manager now says: "${instruction}"

Existing open follow-up tasks for this same item:
${existingLines}

Rules:
1. Dates. Resolve relative dates against today: "today", "tonight", "this morning/afternoon/evening" (today; afternoon is about 1:00 PM), "tomorrow", a weekday name (the next occurrence — if today IS that weekday, use today), "next Monday" (Monday of next week), "in three days". Output due_date as YYYY-MM-DD and due_time as HH:mm 24h when a time was said or clearly implied ("at 2" or "2pm" → 14:00, "9:30" → 09:30, "this afternoon" → 13:00, "this morning" → 09:00, "end of day" → 17:00, "stand-up meeting" with no stated time → leave the time empty). NEVER invent a date or time the manager did not give. Date only → leave due_time empty.
2. Timing you cannot schedule. Relay cannot detect when a person arrives, when an investigation finishes, or when a delivery shows up. If the manager's timing is a real-world condition — "when John gets here", "after we investigate", "when the delivery arrives" — keep the manager's words in reminder_note, leave due_date and due_time empty, and set needs_clarification=true with clarification_question exactly: "When should I remind you?". Do NOT guess a date.
3. "this" always refers to the item above; the manager never repeats it. Write a short, specific title that names the work, e.g. "Discuss this review at today's stand-up", "Check with the banquet manager", "Follow up with Jane about the private event".
4. task_type from the list. "Discuss" for bringing something up with the team or at a meeting; "Call" for phone; "Email" for writing to someone later; "Check" for verifying something; "Investigate"; "Meeting"; "Follow up"; "Customer follow-up"; "Internal follow-up"; "Other". priority "High" only for clearly urgent wording ("urgent", "asap", "right away"); "Low" for "whenever you get a chance"; otherwise "Normal".
5. Draft requests. If the manager asks to email/message someone in the future ("email the owner after we investigate this"), set task_type "Email" and draft_requested=true, and write draft_subject plus a short, polite, plain-text draft_body the manager can edit. Use [Name] placeholders when a name is unknown. The draft is saved in Relay only — it is never sent automatically.
6. Duplicates. If the request clearly refers to an existing open task for this item — the same intent again, or "actually ..." adjusting it ("actually remind me tomorrow instead") — use intent "update_task" with that task's existing_task_id and the corrected details; never create a duplicate. Create a new task only when no existing task matches. If the message contains no follow-up at all (e.g. "no", "thanks"), use intent "no_task".

Return JSON only.`,
      response_json_schema: PARSE_SCHEMA,
    });

    const intent = llm.intent || "create_task";
    if (intent === "no_task") {
      return Response.json({ created_new: false, updated_existing: false, task: null, no_task: true });
    }

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
      if (["High", "Normal", "Low"].includes(llm.priority)) patch.priority = llm.priority;
      if (llm.due_date) patch.due_date = llm.due_date;
      if (llm.due_time) patch.due_time = llm.due_time;
      if (llm.draft_requested) {
        patch.draft_email = llm.draft_body || target.draft_email || "";
        patch.draft_subject = llm.draft_subject || target.draft_subject || "";
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

    // Create the task.
    const title = String(llm.title || "Follow up").slice(0, 200);
    const dueDate = llm.due_date || "";
    const dueTime = llm.due_time || "";
    let reminderAt = null;
    let reminderStatus = "none";
    if (dueDate) {
      reminderAt = zonedToUtcIso(dueDate, dueTime, tz);
      if (reminderAt) reminderStatus = "pending";
    }
    const task = await base44.entities.Task.create({
      restaurant_id: restaurantId,
      title,
      description: "",
      task_type: TASK_TYPES.includes(llm.task_type) ? llm.task_type : "Follow up",
      status: "Open",
      priority: ["High", "Normal", "Low"].includes(llm.priority) ? llm.priority : "Normal",
      source_type: sourceType,
      source_id: sourceId,
      source_label: sourceLabel,
      due_date: dueDate,
      due_time: dueTime,
      reminder_at: reminderAt || "",
      reminder_note: llm.reminder_note || "",
      reminder_status: reminderStatus,
      snooze_until: "",
      draft_email: llm.draft_requested ? String(llm.draft_body || "").slice(0, 5000) : "",
      draft_subject: llm.draft_requested ? String(llm.draft_subject || "").slice(0, 200) : "",
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
      needs_clarification: !!llm.needs_clarification,
      clarification_question: llm.needs_clarification
        ? (llm.clarification_question || "When should I remind you?")
        : null,
      task,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}