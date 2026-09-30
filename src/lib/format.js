export function formatCurrency(value) {
  if (!value && value !== 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatValueRange(min, max) {
  if (!min && !max) return "—";
  if (min && max) return `${formatCurrency(min)}–${formatCurrency(max)}`;
  return formatCurrency(min || max);
}

// The restaurant's configured local timezone (IANA name). All displayed
// timestamps — activity history, received times, opportunity dates — are
// shown in this timezone; stored timestamps stay UTC. Until the configured
// timezone loads, this defaults to the restaurant's timezone (Pacific Time
// for Oak & Vine) — never the viewer's browser timezone.
let activeTimezone = "America/Los_Angeles";

// Platform-set timestamps (created_date, updated_date, and record fields set
// without an explicit offset) arrive as naive ISO strings stored in UTC —
// e.g. "2026-09-30T05:31:36.594000". JavaScript would parse those as the
// VIEWER's local time, shifting every display by the timezone offset. Parse
// offset-less strings as UTC instead; strings that already carry an offset
// (…Z, …+00:00, …-07:00) are correct as-is.
function parseTimestamp(dateStr) {
  if (typeof dateStr !== "string") return new Date(dateStr);
  if (/Z$/i.test(dateStr) || /[+-]\d{2}:?\d{2}$/.test(dateStr)) return new Date(dateStr);
  const iso = dateStr.includes(" ") ? dateStr.replace(" ", "T") : dateStr;
  if (iso.includes("T")) return new Date(iso + "Z");
  return new Date(iso + "T00:00:00Z");
}

export function setActiveTimezone(tz) {
  activeTimezone = typeof tz === "string" && tz ? tz : null;
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date = parseTimestamp(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: activeTimezone || undefined,
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  const date = parseTimestamp(dateStr);
  return (
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: activeTimezone || undefined }) +
    " at " +
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: activeTimezone || undefined })
  );
}

export function timeAgo(dateStr) {
  if (!dateStr) return "";
  const date = parseTimestamp(dateStr);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

export function getRestaurantId(user) {
  if (!user) return null;
  return user.restaurant_id || user.data?.restaurant_id || null;
}

export function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return parts[0].charAt(0).toUpperCase() + parts[parts.length - 1].charAt(0).toUpperCase();
}