import React from "react";
import { Link } from "react-router-dom";
import { Inbox as InboxIcon, ArrowRight } from "lucide-react";

// A compact read on what arrived, straight from Relay's existing
// classification data. Every category — including Needs review — opens the
// matching Inbox filter.
export default function NewEmailsSection({ emails }) {
  const newEmails = (emails && emails.new) || 0;
  const breakdown = (emails && emails.breakdown) || {};
  const categories = [
    { label: "Opportunities", count: breakdown.opportunity, filter: "Opportunity" },
    { label: "Immediate Attention", count: breakdown.attention, filter: "Attention" },
    { label: "Administrative", count: breakdown.administrative, filter: "Administrative" },
    { label: "Informational", count: breakdown.informational, filter: "Routine" },
    { label: "Spam", count: breakdown.spam, filter: "Spam" },
    { label: "Needs review", count: breakdown.needs_review, filter: "Needs review" },
  ].filter((c) => c.count > 0);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          New Emails <span className="text-muted-foreground font-normal">({newEmails})</span>
        </h2>
        <Link to="/inbox" className="text-sm text-primary hover:underline flex items-center gap-1">
          Open Inbox <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="bg-card rounded-xl border border-border p-4 md:p-5">
        {newEmails === 0 ? (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <InboxIcon className="w-4 h-4" /> You're all caught up — no new emails.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const inner = (
                <>
                  {c.label}
                  <span className="font-semibold">{c.count}</span>
                </>
              );
              return (
                <Link
                  key={c.label}
                  to="/inbox"
                  state={{ analysisFilter: c.filter }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted hover:bg-accent/20 border border-border rounded-full px-3 py-1.5 transition-colors"
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}