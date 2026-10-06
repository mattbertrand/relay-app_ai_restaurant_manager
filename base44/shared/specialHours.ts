// Recurring special hours: recurrence rules resolved on demand — occurrences
// are never materialized as individual records. One-time (dated) special
// hours entries always take precedence over a recurring rule on the same
// date, and a rule's own exception dates skip that occurrence without
// disabling the rule.

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function utcDayName(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return null;
  return DAY_NAMES[new Date(dateStr + "T00:00:00Z").getUTCDay()];
}

// Whether any one-time (dated) temporary/special hours entry covers dateStr.
// Entries without dates stay informational and never block a recurring rule.
function oneTimeCovers(knowledge, dateStr) {
  const oneTime = (knowledge && knowledge.temporary_hours) || [];
  return oneTime.some((t) => {
    if (!t) return false;
    const start = t.start_date || "";
    if (!start) return false;
    const end = t.end_date || start;
    return start <= dateStr && dateStr <= end;
  });
}

// The recurring special hours rules that apply on a given date (YYYY-MM-DD).
export function recurringSpecialHoursForDate(knowledge, dateStr) {
  const day = utcDayName(dateStr);
  if (!day) return [];
  const rules = (knowledge && knowledge.recurring_special_hours) || [];
  const blockedByOneTime = oneTimeCovers(knowledge, dateStr);
  return rules.filter((r) => {
    if (!r || r.day_of_week !== day) return false;
    const eff = r.effective_start_date || "";
    if (eff && dateStr < eff) return false;
    const end = r.end_date || "";
    if (end && dateStr > end) return false;
    const exceptions = Array.isArray(r.exceptions) ? r.exceptions : [];
    if (exceptions.some((x) => x && x.date === dateStr)) return false;
    // Explicit one-time special event wins — the rule is skipped for this date.
    if (blockedByOneTime) return false;
    return true;
  });
}

// Prompt context: the recurrence rules themselves, plus the precedence rules
// the analysis must follow when answering hours questions.
export function formatRecurringSpecialHoursForPrompt(knowledge) {
  const rules = (knowledge && knowledge.recurring_special_hours) || [];
  const lines = rules
    .filter((r) => r && r.label)
    .map((r) => {
      const time = r.start_time || r.end_time ? `${r.start_time || "?"}–${r.end_time || "?"}` : "";
      const eff = r.effective_start_date ? `active from ${r.effective_start_date}` : "";
      const endDate = r.end_date ? `through ${r.end_date}` : "";
      const exceptions = (Array.isArray(r.exceptions) ? r.exceptions : []).filter((x) => x && x.date);
      const ex = exceptions.length
        ? `; skipped on: ${exceptions.map((x) => x.date + (x.note ? ` (${x.note})` : "")).join(", ")}`
        : "";
      return `- ${r.label}: every ${r.day_of_week || "?"}${time ? `, ${time}` : ""}${eff ? `, ${eff}` : ""}${
        endDate ? `, ${endDate}` : ""
      }${ex}`;
    })
    .filter(Boolean);
  if (!lines.length) return null;
  return `RECURRING SPECIAL HOURS (weekly rules maintained by the manager — occurrences are computed from the rule, not stored. A recurring rule does NOT apply on its exception dates, and a one-time special-hours entry on the same date always takes precedence over the recurring rule — the restaurant follows the one-time entry that day.)\n${lines.join(
    "\n"
  )}`;
}