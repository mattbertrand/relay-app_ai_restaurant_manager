import React from "react";
import { Mail, Target, Bell, CheckSquare, Star, MessageSquareWarning } from "lucide-react";

// The one-glance workload summary. Each number is a distinct count from the
// server pass — no item is counted twice.
export default function WorkloadSummary({ summary }) {
  const chips = [
    { icon: Mail, value: summary.new_emails, label: "New Emails", tone: "text-blue-700 bg-blue-50 border-blue-200" },
    { icon: Target, value: summary.opportunities, label: "Opportunities", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { icon: Bell, value: summary.immediate_attention, label: "Immediate Attention", tone: "text-amber-700 bg-amber-50 border-amber-200" },
    { icon: CheckSquare, value: summary.follow_ups, label: "Follow-ups", tone: "text-primary bg-primary/10 border-primary/20" },
    { icon: Star, value: summary.new_reviews, label: "New Reviews", tone: "text-violet-700 bg-violet-50 border-violet-200" },
    { icon: MessageSquareWarning, value: summary.reviews_needs_response, label: "Review Needs Response", tone: "text-red-700 bg-red-50 border-red-200" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      {chips.map((c) => {
        const Icon = c.icon;
        return (
        <div key={c.label} className="bg-card rounded-xl border border-border p-3.5">
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-2 ${c.tone}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="text-xl font-semibold text-foreground font-heading">{c.value}</div>
          <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{c.label}</div>
        </div>
        );
      })}
    </div>
  );
}