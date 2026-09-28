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
// shown in this timezone; stored timestamps stay UTC. Unset falls back to
// the viewer's own browser timezone.
let activeTimezone = null;

export function setActiveTimezone(tz) {
  activeTimezone = typeof tz === "string" && tz ? tz : null;
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: activeTimezone || undefined,
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return (
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: activeTimezone || undefined }) +
    " at " +
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: activeTimezone || undefined })
  );
}

export function timeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
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