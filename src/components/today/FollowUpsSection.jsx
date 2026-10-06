import React from "react";
import { Link } from "react-router-dom";
import { formatTime12 } from "@/lib/format";
import { cn } from "@/lib/utils";

// Today's "Your Follow-ups" — the tasks the manager explicitly committed to,
// due today plus anything overdue. Deliberately compact: it answers "what do
// I need to do today?" without crowding out Needs Action (what Relay
// identified) — the two stay separate on purpose.
export default function FollowUpsSection({ items }) {
  if (!items || !items.length) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Your Follow-ups <span className="text-muted-foreground font-normal text-sm">— {items.length}</span>
        </h2>
        <Link to="/tasks" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </div>
      <div className="bg-card rounded-xl border border-border divide-y divide-border">
        {items.map((t) => (
          <Link
            key={t.id}
            to="/tasks"
            state={{ focusTaskId: t.id }}
            className="flex items-start gap-3 p-4 hover:bg-muted/40 transition-colors"
          >
            <span
              className={cn(
                "text-xs font-medium tabular-nums w-20 shrink-0 pt-0.5",
                t.overdue ? "text-red-600" : "text-muted-foreground"
              )}
            >
              {t.overdue ? "Overdue" : t.due_time ? formatTime12(t.due_time) : "Today"}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
              {t.source_label && <p className="text-xs text-muted-foreground mt-0.5">{t.source_label}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}