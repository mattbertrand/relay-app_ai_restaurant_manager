// Deterministic calendar checks for email date reasoning — computed in code,
// not by the model, so impossible dates and weekday mismatches are caught
// reliably. The restaurant's timezone anchors "today" (an ISO YYYY-MM-DD in
// the restaurant's local time).
//
// Cases handled:
//   A. Impossible date   — "September 31": the date does not exist.
//   B. Weekday mismatch  — "Tuesday September 30, 2026": the date exists but
//                          falls on a different weekday. Never resolved by
//                          assuming which part the sender intended — the
//                          manager asks for clarification instead.
//   C. Valid + matching  — no issue reported; normal handling continues.

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const MONTH_NAMES = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const WEEKDAY_NUMBERS = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tues: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thurs: 4, thur: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MONTH_DISPLAY = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isLeap(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(month, year) {
  if (month === 2 && isLeap(year)) return 29;
  return MONTH_DAYS[month - 1];
}

function monthFromName(raw) {
  const name = (raw || "").toLowerCase().replace(/\.$/, "");
  for (const [prefix, month] of Object.entries(MONTH_NAMES)) {
    if (name.startsWith(prefix)) return month;
  }
  return null;
}

function weekdayFromName(raw) {
  return WEEKDAY_NUMBERS[(raw || "").toLowerCase()] ?? null;
}

function weekdayOf(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function expandYear(raw) {
  const n = parseInt(raw, 10);
  if (isNaN(n)) return null;
  if (raw.length === 4) return n;
  if (raw.length === 2) return 2000 + n;
  return n;
}

// Scans the message for date expressions (month-name dates like
// "September 30, 2026" / "the 30th of September", and numeric dates like
// "9/31") and weekday mentions, then checks the calendar. Returns
// { issue, detail } — issue is "none", "impossible_date", or
// "weekday_mismatch"; when the year is unstated, both the current and the
// next year are considered and only a mismatch across ALL of them is
// reported (an unstated year is never silently resolved).
export function detectDateIssue(text, todayISO) {
  const lower = (text || "").toLowerCase();
  if (!lower) return { issue: "none", detail: "" };

  const thisYear = new Date((todayISO || "") + "T00:00:00Z").getUTCFullYear() || new Date().getUTCFullYear();

  const mentionedWeekdays = new Set();
  for (const name of Object.keys(WEEKDAY_NUMBERS)) {
    if (new RegExp("\\b" + name + "\\b").test(lower)) mentionedWeekdays.add(WEEKDAY_NUMBERS[name]);
  }

  // { month, day, yearExplicit, year }
  const candidates = [];

  // "September 30, 2026", "Sept 30", "September 30th"
  const monthDay = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/gi;
  for (const m of lower.matchAll(monthDay)) {
    const month = monthFromName(m[1]);
    const day = parseInt(m[2], 10);
    if (!month || !day) continue;
    candidates.push({
      month,
      day,
      year: m[3] ? expandYear(m[3]) : null,
      yearExplicit: !!m[3],
    });
  }

  // "the 30th of September"
  const dayOfMonth = /\bthe\s+(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b/gi;
  for (const m of lower.matchAll(dayOfMonth)) {
    const day = parseInt(m[1], 10);
    const month = monthFromName(m[2]);
    if (!month || !day) continue;
    candidates.push({ month, day, year: null, yearExplicit: false });
  }

  // Numeric "9/31" or "9/31/2026" (US month/day order)
  const numeric = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g;
  for (const m of lower.matchAll(numeric)) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month < 1 || month > 12 || day < 1) continue;
    candidates.push({
      month,
      day,
      year: m[3] ? expandYear(m[3]) : null,
      yearExplicit: !!m[3],
    });
  }

  for (const c of candidates) {
    const years = c.yearExplicit && c.year ? [c.year] : [thisYear, thisYear + 1];
    let impossible = false;
    let mismatch = true;
    for (const y of years) {
      if (c.day > daysInMonth(c.month, y)) {
        impossible = true;
        mismatch = false;
        break;
      }
      const wd = weekdayOf(y, c.month, c.day);
      if (mentionedWeekdays.size === 0 || mentionedWeekdays.has(wd)) {
        mismatch = false;
        break;
      }
    }
    if (impossible) {
      return {
        issue: "impossible_date",
        detail: `${MONTH_DISPLAY[c.month - 1]} ${c.day} does not exist — ${MONTH_DISPLAY[c.month - 1]} has ${daysInMonth(c.month, years[years.length - 1])} days.`,
      };
    }
    if (mismatch && mentionedWeekdays.size > 0) {
      const stated = WEEKDAY_NAMES[[...mentionedWeekdays][0]];
      const actual = WEEKDAY_NAMES[weekdayOf(years[0], c.month, c.day)];
      const yearLabel = c.yearExplicit ? ` ${years[0]}` : "";
      return {
        issue: "weekday_mismatch",
        detail: `${MONTH_DISPLAY[c.month - 1]} ${c.day}${yearLabel} falls on a ${actual}, not a ${stated}. Do not decide which part the sender intended — ask them to confirm which date they meant.`,
      };
    }
  }

  // D. Ambiguous date — a bare day of the month with no month or year
  // ("Friday the 23rd", "can we book the 15th"). The intended date cannot be
  // determined, so it is never silently resolved to the nearest matching
  // month; the draft must ask the sender to confirm the exact date.
  const bareDay = /\bthe\s+(\d{1,2})(?:st|nd|rd|th)(?!\s+of\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec))/gi;
  for (const m of lower.matchAll(bareDay)) {
    const day = parseInt(m[1], 10);
    if (day < 1 || day > 31) continue;
    return {
      issue: "ambiguous_date",
      detail: `The message mentions a day of the month ("${m[0].trim()}") without a month or year — the intended date cannot be determined. Do not choose a month; the draft must ask the sender to confirm the exact month and date they meant.`,
    };
  }

  return { issue: "none", detail: "" };
}