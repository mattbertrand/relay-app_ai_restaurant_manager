import React from "react";
import { Link } from "react-router-dom";
import { Bell, Mail, Target, Star, CheckSquare, ArrowRight, CheckCircle2 } from "lucide-react";

const KIND_ICONS = { email: Mail, opportunity: Target, follow_up: CheckSquare, review: Star };

// The most prominent section: the items that genuinely need the manager,
// prioritized by the dashboard (due/overdue follow-ups first, then
// repeated-contact and high-priority items).
export default function AttentionSection({ items }) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">Needs Your Attention</h2>
        <Link to="/opportunities" className="text-sm text-primary hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {(!items || items.length === 0) ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">You're all caught up</p>
          <p className="text-xs text-muted-foreground mt-1">Nothing needs your attention right now.</p>
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
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold tracking-wide text-primary">{item.label}</p>
                    <h3 className="text-sm font-medium text-foreground mt-0.5">{item.title}</h3>
                    {item.lines.map((line, i) =>
                      line ? (
                        <p key={i} className="text-xs text-muted-foreground mt-1">{line}</p>
                      ) : null
                    )}
                  </div>
                  {(item.urgency === "overdue" || item.urgency === "due") && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                        item.urgency === "overdue"
                          ? "text-red-700 bg-red-50 border border-red-200"
                          : "text-amber-700 bg-amber-50 border border-amber-200"
                      }`}
                    >
                      {item.urgency === "overdue" ? "Overdue" : "Due today"}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}