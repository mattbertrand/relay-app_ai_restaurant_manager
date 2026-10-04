import React from "react";
import { Link } from "react-router-dom";
import { Inbox as InboxIcon, ArrowRight } from "lucide-react";

// A compact read on what arrived, straight from Relay's existing
// classification data. Each category opens the matching Inbox filter.
export default function NewEmailsSection({ summary }) {
  const categories = [
    { label: "Opportunities", count: summary.emails.opportunity, filter: "Opportunity" },
    { label: "Immediate Attention", count: summary.emails.attention, filter: "Attention" },
    { label: "Administrative", count: summary.emails.administrative, filter: "Administrative" },
    { label: "Informational", count: summary.emails.informational, filter: "Routine" },
    { label: "Spam", count: summary.emails.spam, filter: "Spam" },
    { label: "Needs review", count: summary.emails.needs_review, filter: null },
  ].filter((c) => c.count > 0);

  return (
    <section className="mb-8">
      <h2 className="font-heading text-lg font-semibold text-foreground mb-4">New Emails</h2>
      <div className="bg-card rounded-xl border border-border p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <InboxIcon className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {summary.new_emails} new email{summary.new_emails === 1 ? "" : "s"}
          </p>
        </div>
        {categories.length === 0 ? (
          <p className="text-xs text-muted-foreground">No new emails to review.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const inner = (
                <>
                  {c.label}
                  <span className="font-semibold">{c.count}</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </>
              );
              return c.filter ? (
                <Link
                  key={c.label}
                  to="/inbox"
                  state={{ analysisFilter: c.filter }}
                  className="group inline-flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted hover:bg-accent/20 border border-border rounded-full px-3 py-1.5 transition-colors"
                >
                  {inner}
                </Link>
              ) : (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted border border-border rounded-full px-3 py-1.5"
                >
                  {inner}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}