// Provider-agnostic schedule layer for Relay's Today dashboard and
// meeting-request drafts. Only Google Calendar is connectable today (a
// Base44-managed app-user connection — each manager signs in with their own
// Google account); the returned schedule shape is provider-independent so
// Outlook/Microsoft 365 or another system can be added without changing any
// consumer. Relay reads the schedule — it never creates events and never
// sends invitations.

const GOOGLE_CALENDAR_CONNECTOR_ID = "6ac29c6ed9e0034a9ab7d5cb";

// The providers the Schedule connection state offers. `available: true` means
// the manager can actually connect today; the others are shown as coming soon
// and never pretend to be connected.
export const SCHEDULE_PROVIDERS = [
  { id: "google_calendar", label: "Google Calendar", hint: "Connect your Google account", available: true },
  { id: "microsoft_365", label: "Microsoft Outlook / 365", hint: "Coming soon", available: false },
  { id: "other", label: "Other calendar systems", hint: "Coming soon", available: false },
];

// A cheap pre-check: the calendar is consulted only for messages that ask
// about meeting, availability, or scheduling — never for every email.
export function schedulingRequestLikely(text) {
  return /\b(meet|meeting|meetings|available|availability|schedule|scheduling|scheduled|appointment|stop by|come by|get together|touch base|book a (call|meeting|time)|set up a (call|meeting|time)|good time to|time to (talk|discuss|meet)|would you be (able|open))\b/i.test(
    String(text || "")
  );
}

function dayFmt(tz) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
}
function timeFmt(tz) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
}
function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Provider events → normalized {date, time_label, title} in the restaurant's
// timezone, limited to [fromISO, toISO]. Today's date anchors everything.
export function normalizeCalendarEvents(items, tz, fromISO, toISO) {
  const day = dayFmt(tz);
  const time = timeFmt(tz);
  const events = [];
  for (const it of items || []) {
    const start = (it.start && (it.start.dateTime || it.start.date)) || "";
    if (!start) continue;
    const allDay = !(it.start && it.start.dateTime);
    const startDate = allDay ? new Date(`${start}T12:00:00`) : new Date(start);
    if (isNaN(startDate.getTime())) continue;
    const date = day.format(startDate);
    if (date < fromISO || date > toISO) continue;
    let label = allDay ? "All day" : time.format(startDate);
    const endRaw = it.end && (it.end.dateTime || it.end.date);
    if (!allDay && endRaw) {
      const endDate = new Date(endRaw);
      if (!isNaN(endDate.getTime()) && day.format(endDate) === date) {
        label += `–${time.format(endDate)}`;
      }
    }
    events.push({ date, time_label: label, title: String(it.summary || "").trim() || "(untitled)" });
  }
  events.sort((a, b) => (a.date + a.time_label).localeCompare(b.date + b.time_label));
  return events;
}

// Today's events plus a 7-day count summary — the Schedule section's data.
export function summarizeSchedule(events, todayISO) {
  const byDate = {};
  for (const e of events) byDate[e.date] = (byDate[e.date] || 0) + 1;
  const week = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(todayISO, i);
    const label = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(
      new Date(`${iso}T12:00:00Z`)
    );
    week.push({ date: iso, day: label, count: byDate[iso] || 0 });
  }
  return {
    today: events.filter((e) => e.date === todayISO).map((e) => ({ time: e.time_label, title: e.title })),
    week,
  };
}

// Availability for a meeting-request draft: the manager's REAL commitments —
// never invented. Times not listed are free.
export function availabilityText(events, todayISO) {
  if (!events || !events.length) {
    return `The connected calendar shows no events in the next 7 days (${todayISO} onward), so any proposed time in that window is genuinely free.`;
  }
  const byDate = {};
  for (const e of events) (byDate[e.date] = byDate[e.date] || []).push(`${e.time_label} ${e.title}`);
  const lines = Object.keys(byDate)
    .sort()
    .map((d) => `- ${d}: ${byDate[d].join("; ")}`);
  return `The manager's commitments in the next 7 days (restaurant's local time):\n${lines.join("\n")}\nAny time in the next 7 days NOT listed above is free.`;
}

async function fetchGoogleEvents(accessToken, timeMin, timeMax) {
  const url =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events" +
    `?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
    "&singleEvents=true&orderBy=startTime&maxResults=100";
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Google Calendar request failed (${res.status})`);
  const data = await res.json();
  return data.items || [];
}

// For the Today dashboard: connection state + the schedule. Never throws —
// a missing connection or an unreachable provider is simply "not connected".
export async function calendarScheduleContext(base44, timezone) {
  const tz = timezone || "America/Los_Angeles";
  const todayISO = dayFmt(tz).format(new Date());
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(
      GOOGLE_CALENDAR_CONNECTOR_ID
    );
    const items = await fetchGoogleEvents(
      accessToken,
      new Date().toISOString(),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    );
    const events = normalizeCalendarEvents(items, tz, todayISO, addDays(todayISO, 6));
    const summary = summarizeSchedule(events, todayISO);
    return {
      connected: true,
      provider: "google_calendar",
      provider_label: "Google",
      today: summary.today,
      week: summary.week,
      scheduled_today: summary.today.length,
    };
  } catch (e) {
    return { connected: false };
  }
}

// For analysis: a prompt block only when the message asks to meet AND a
// calendar is connected — otherwise "" (drafts must never claim availability).
export async function calendarAnalysisContext(base44, knowledge, subject, body) {
  if (!schedulingRequestLikely(`${subject || ""}\n${body || ""}`)) return "";
  const tz = (knowledge && knowledge.timezone) || "America/Los_Angeles";
  const todayISO = dayFmt(tz).format(new Date());
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(
      GOOGLE_CALENDAR_CONNECTOR_ID
    );
    const items = await fetchGoogleEvents(
      accessToken,
      new Date().toISOString(),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    );
    const events = normalizeCalendarEvents(items, tz, todayISO, addDays(todayISO, 6));
    return availabilityText(events, todayISO);
  } catch (e) {
    return ""; // no connected calendar (or unreachable) — no availability claims
  }
}