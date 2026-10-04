import React from "react";
import { Link } from "react-router-dom";
import { Mail, Target, Bell, CheckCircle2 } from "lucide-react";

const KIND_ICONS = { email: Mail, opportunity: Target, follow_up: Bell };

// The ONE prioritized workload queue. Revenue, In Progress, Attention, Vendor,
// Reservation, Event — all labels here, never separate sections.
export default function NeedsActionSection({ items, count }) {
  return (
    <section id="needs-action" className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Needs Action <span className="text-muted-foreground font-normal">({count || 0})</span>
        </h2>
        <Link to="/opportunities" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </div>

      {(!items || items.length === 0) ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No items need your attention.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const Icon = KIND_ICONS[item.kind] || Bell;
            const border =
              item.urgency === "overdue" ? "border-l-4 border-l-red-400" :
              item.urgency === "high" || item.urgency === "due" ? "border-l-4 border-l-amber-400" : "";
            return (
              <Link
                key={`${item.kind}-${item.id}`}
                to={item.link}
                state={item.focus_conversation_id ? { focusConversationId: item.focus_conversation_id } : undefined}
                className={`block bg-card rounded-xl border border-border p-4 hover:border-primary/30 hover:shadow-sm transition-all ${border}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
                    {item.lines.map((line, i) =>
                      line ? (
                        <p key={i} className="text-xs text-muted-foreground mt-0.5">{line}</p>
                      ) : null
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {item.when && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            item.urgency === "overdue"
                              ? "text-red-700 bg-red-50 border border-red-200"
                              : item.urgency === "due"
                              ? "text-amber-700 bg-amber-50 border border-amber-200"
                              : "text-muted-foreground bg-muted border border-border"
                          }`}
                        >
                          {item.when}
                        </span>
                      )}
                      {(item.tags || []).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full text-stone-600 bg-stone-100 border border-stone-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}