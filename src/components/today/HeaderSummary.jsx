import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

// The one-glance day summary. Each count is clickable and goes straight to
// the relevant work (or scrolls to its section on this page).
export default function HeaderSummary({ name, counts }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const chips = [];
  if (counts.need_action > 0) {
    chips.push({
      key: "need_action",
      label: `${counts.need_action} need action`,
      onClick: () => scrollTo("needs-action"),
      tone: "text-amber-700 bg-amber-50 border-amber-200",
    });
  }
  if (counts.follow_ups > 0) {
    chips.push({
      key: "follow_ups",
      label: `${counts.follow_ups} follow-up${counts.follow_ups === 1 ? "" : "s"}`,
      to: "/actions",
      tone: "text-primary bg-primary/10 border-primary/20",
    });
  }
  if (counts.new_emails > 0) {
    chips.push({
      key: "new_emails",
      label: `${counts.new_emails} new email${counts.new_emails === 1 ? "" : "s"}`,
      to: "/inbox",
      tone: "text-blue-700 bg-blue-50 border-blue-200",
    });
  }
  if (counts.new_reviews > 0) {
    chips.push({
      key: "new_reviews",
      label: `${counts.new_reviews} new review${counts.new_reviews === 1 ? "" : "s"}`,
      to: "/reviews",
      tone: "text-violet-700 bg-violet-50 border-violet-200",
    });
  }
  if (counts.calendar_connected) {
    chips.push({
      key: "scheduled",
      label: `${counts.scheduled_today} scheduled today`,
      onClick: () => scrollTo("schedule"),
      tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
    });
  }

  const chipClass = "text-xs font-medium rounded-full px-3 py-1.5 border transition-colors hover:opacity-80";
  return (
    <div className="mb-6">
      <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">
        Hi, {name}. Here's your day.
      </h1>
      {chips.length === 0 ? (
        <p className="text-muted-foreground text-sm mt-2 inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> You're all caught up.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 mt-3">
          {chips.map((c) =>
            c.to ? (
              <Link key={c.key} to={c.to} className={`${chipClass} ${c.tone}`}>
                {c.label}
              </Link>
            ) : (
              <button key={c.key} onClick={c.onClick} className={`${chipClass} ${c.tone}`}>
                {c.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}