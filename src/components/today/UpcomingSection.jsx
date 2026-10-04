import React, { useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";

// Today & Upcoming — a chronological read of what Relay actually knows:
// follow-up due dates, dated event/reservation opportunities, the profile's
// special hours, and recurring offerings for today. Never invented dates.
// Complements the calendar Schedule — it doesn't duplicate it.
export default function UpcomingSection({ todayItems, upcomingItems, upcomingAll }) {
  const [showAll, setShowAll] = useState(false);
  const hasToday = todayItems && todayItems.length > 0;
  const upcoming = showAll ? upcomingAll || [] : upcomingItems || [];
  const hasUpcoming = upcoming.length > 0;
  const total = (todayItems || []).length + ((upcomingAll || []).length);

  return (
    <section className="mb-8">
      <h2 className="font-heading text-lg font-semibold text-foreground mb-4">
        Today & Upcoming <span className="text-muted-foreground font-normal">({total})</span>
      </h2>
      <div className="bg-card rounded-xl border border-border p-4 md:p-5">
        {!hasToday && !hasUpcoming ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled or upcoming in Relay right now.</p>
        ) : (
          <>
            {hasToday && (
              <div className="mb-4">
                <p className="text-[11px] font-semibold tracking-wide text-primary mb-2">TODAY</p>
                <ul className="space-y-1.5">
                  {todayItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <CalendarDays className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hasUpcoming && (
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground mb-2">UPCOMING</p>
                <ul className="space-y-1.5">
                  {upcoming.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-xs text-muted-foreground w-16 flex-shrink-0 mt-0.5">
                        {new Date(`${item.date}T12:00:00Z`).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                      </span>
                      {item.label}
                    </li>
                  ))}
                </ul>
                {upcomingAll && upcomingAll.length > (upcomingItems || []).length && (
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3"
                  >
                    {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {showAll ? "Show less" : `Next 30 days (${upcomingAll.length})`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}