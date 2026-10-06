import { base44 } from "@/api/base44Client";
import { todayInTimezone, formatTime12 } from "@/lib/format";

// Follow-up tasks: source relationships, when-labels, snooze math, and the
// activity-history helper — shared by the follow-up prompt, the Tasks page,
// and the Today follow-ups section.

export function sourcePathFor(task) {
  if (!task || !task.source_id) return null;
  if (task.source_type === "review") return `/reviews/${task.source_id}`;
  if (task.source_type === "opportunity") return `/opportunities/${task.source_id}`;
  return null; // email sources open via navigateToSource (focus state)
}

// fromTasks: when the manager came from the Follow-ups page, the source
// detail shows "Back to Follow-ups" instead of its usual list back-link.
export function navigateToSource(navigate, task, opts = {}) {
  if (!task || !task.source_id) return false;
  const state = opts.fromTasks ? { backTo: "tasks" } : undefined;
  if (task.source_type === "review") {
    navigate(`/reviews/${task.source_id}`, state ? { state } : undefined);
    return true;
  }
  if (task.source_type === "opportunity") {
    navigate(`/opportunities/${task.source_id}`, state ? { state } : undefined);
    return true;
  }
  if (task.source_type === "email") {
    navigate("/inbox", { state: { focusConversationId: task.source_id, ...(state || {}) } });
    return true;
  }
  return false;
}

function shortDate(iso) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch (e) {
    return iso;
  }
}

function addDaysIso(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// When-line for a task, in the restaurant's local terms: "Today · 2:00 PM",
// "Tomorrow", "Oct 9 · 9:00 AM", "Overdue · Oct 2", or the manager's own
// contextual trigger when no date was ever set ("when John gets here").
export function taskWhenLabel(task, todayStr) {
  const today = todayStr || todayInTimezone();
  if (!task.due_date) {
    return task.reminder_note ? task.reminder_note : "No date yet";
  }
  const time = task.due_time ? ` · ${formatTime12(task.due_time)}` : "";
  if (task.due_date < today) return `Overdue · ${shortDate(task.due_date)}${time}`;
  if (task.due_date === today) return `Today${time}`;
  if (task.due_date === addDaysIso(today, 1)) return `Tomorrow${time}`;
  return `${shortDate(task.due_date)}${time}`;
}

export function isOverdue(task, todayStr) {
  const today = todayStr || todayInTimezone();
  return !!task.due_date && task.due_date < today;
}

export function isSnoozed(task) {
  if (!task.snooze_until) return false;
  const until = Date.parse(task.snooze_until);
  return !!(until && until > Date.now());
}

// Restaurant-local wall time → UTC ISO (same two-pass conversion Relay uses
// server-side, so reminders and snoozes line up with the restaurant clock).
export function zonedToUtcIso(dateStr, timeStr, tz) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return null;
  let time = String(timeStr || "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(time)) time = "09:00";
  else if (time.length === 4) time = "0" + time;
  const naive = Date.parse(`${dateStr}T${time}:00Z`);
  if (isNaN(naive)) return null;
  try {
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
  } catch (e) {
    return new Date(`${dateStr}T${time}:00Z`).toISOString();
  }
}

// Snooze options: 1 hour, later today, tomorrow — as UTC instants.
export function snoozeOptions() {
  const now = new Date();
  const today = todayInTimezone();
  const tomorrow = addDaysIso(today, 1);
  const at = (date, time) => zonedToUtcIso(date, time, null) || new Date(`${date}T${time}:00Z`).toISOString();
  const laterToday = new Date(`${today}T18:00:00Z`);
  return [
    { id: "1h", label: "Snooze 1 hour", until: new Date(now.getTime() + 3600000).toISOString() },
    {
      id: "later",
      label: "Later today",
      until: laterToday > now ? at(today, "18:00") : new Date(now.getTime() + 2 * 3600000).toISOString(),
    },
    { id: "tomorrow", label: "Tomorrow", until: at(tomorrow, "09:00") },
  ];
}

// Task events land in the source item's Activity History, so the manager can
// see the full story on the review, email, or opportunity the task came from.
export async function taskActivity(task, type, description) {
  const actSource = {};
  if (task.source_type === "review" && task.source_id) actSource.review_id = task.source_id;
  else if (task.source_type === "email" && task.source_id) actSource.conversation_id = task.source_id;
  else if (task.source_type === "opportunity" && task.source_id) actSource.opportunity_id = task.source_id;
  await base44.entities.Activity.create({
    restaurant_id: task.restaurant_id,
    ...actSource,
    type,
    description,
    is_demo: /demo/i.test(task.source_label || "") || false,
  });
}