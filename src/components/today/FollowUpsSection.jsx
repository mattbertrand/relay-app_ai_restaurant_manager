import React from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";

// Things the manager personally promised to follow up on — created only from
// recorded responses, never from an unapproved draft. A follow-up with no
// stated date shows as needing scheduling.
export default function FollowUpsSection({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">Follow-ups</h2>
        <Link to="/actions" className="text-sm text-primary hover:underline">
          All actions
        </Link>
      </div>
      <div className="bg-card rounded-xl border border-border divide-y divide-border">
        {items.map((f) => (
          <Link
            key={f.id}
            to={f.link}
            state={f.focus_conversation_id ? { focusConversationId: f.focus_conversation_id } : undefined}
            className="flex items-start gap-3 p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{f.description}</p>
              <p className="text-xs mt-1">
                {f.overdue ? (
                  <span className="text-red-600 font-medium">Overdue</span>
                ) : f.due_today ? (
                  <span className="text-amber-600 font-medium">Due today</span>
                ) : f.due_date ? (
                  <span className="text-muted-foreground">Due {f.due_date}</span>
                ) : (
                  <span className="text-muted-foreground italic">Needs scheduling</span>
                )}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}