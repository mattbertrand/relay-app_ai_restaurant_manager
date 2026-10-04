import React from "react";
import { MapPin, Users, CalendarDays, X } from "lucide-react";

// The events for one selected calendar day — title, times, and any details
// Google provides (location, description, attendees, calendar name). Opened
// by clicking a day tile in the Schedule section; handles one event or many.
export default function EventDayPanel({ date, events, onClose }) {
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-foreground">
          {label} · {events.length} event{events.length === 1 ? "" : "s"}
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <ul className="space-y-3">
        {events.map((e, i) => (
          <li key={i} className="rounded-lg border border-border bg-card p-3">
            <p className="text-sm font-medium text-foreground break-words">{e.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{e.time_label}</p>
            {e.location && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span className="break-words">{e.location}</span>
              </p>
            )}
            {e.description && (
              <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                {e.description}
              </p>
            )}
            {e.attendees && e.attendees.length > 0 && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Users className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span className="break-words">{e.attendees.join(", ")}</span>
              </p>
            )}
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
              <CalendarDays className="w-3 h-3" /> {e.calendar_name}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}