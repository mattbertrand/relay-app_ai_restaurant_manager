import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import ValueConfidenceBadge from "@/components/ValueConfidenceBadge";
import EmptyState from "@/components/EmptyState";
import { formatValueRange, timeAgo } from "@/lib/format";
import { lifecycleStatus } from "@/lib/opportunityLifecycle";
import { Target, ArrowRight } from "lucide-react";
import BackToToday from "@/components/BackToToday";
import { cn } from "@/lib/utils";

const FILTERS = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Dismissed", value: "dismissed" },
];

function matchesFilter(opp, filter) {
  const stage = lifecycleStatus(opp.status);
  if (filter === "all") return true;
  if (filter === "new") return stage === "New";
  if (filter === "in_progress") return stage === "In Progress";
  if (filter === "resolved") return stage === "Resolved";
  if (filter === "dismissed") return stage === "Dismissed";
  return true;
}

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const opps = await base44.entities.Opportunity.list("-created_date", 100);
      setOpportunities(opps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = (opportunities || []).filter((o) => matchesFilter(o, filter));
  const counts = FILTERS.reduce((acc, f) => {
    acc[f.value] = (opportunities || []).filter((o) => matchesFilter(o, f.value)).length;
    return acc;
  }, {});

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
      <BackToToday label="Opportunities" />
      <div className="mb-6">
        <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">Opportunities</h1>
        <p className="text-muted-foreground text-sm mt-1">Customer inquiries and revenue opportunities, all in one place.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
              filter === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground hover:text-foreground border-border"
            )}
          >
            {f.label}
            <span className={cn(
              "text-xs px-1.5 rounded-full",
              filter === f.value ? "bg-primary-foreground/20" : "bg-muted"
            )}>
              {counts[f.value]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No opportunities here"
          description="When customer inquiries come in, Relay will surface them here with context and next steps."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((opp) => (
            <Link
              key={opp.id}
              to={`/opportunities/${opp.id}`}
              className="block bg-card rounded-xl border border-border p-4 md:p-5 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">{opp.type}</span>
                    <PriorityBadge priority={opp.priority} />
                    <ValueConfidenceBadge confidence={opp.value_confidence} />
                    <span className="text-xs text-muted-foreground">{opp.source}</span>
                  </div>
                  <h3 className="font-medium text-foreground text-sm md:text-base">{opp.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{opp.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{opp.customer_name}</span>
                    <span>·</span>
                    <span>{timeAgo(opp.created_date)}</span>
                  </div>
                </div>
                <div className="flex sm:flex-col sm:items-end gap-2 sm:gap-1.5">
                  <div className="text-sm font-semibold text-foreground whitespace-nowrap">
                    {formatValueRange(opp.estimated_value_min, opp.estimated_value_max)}
                  </div>
                  <StatusBadge status={lifecycleStatus(opp.status)} />
                  {lifecycleStatus(opp.status) === "New" && (
                    <span className="text-[11px] text-amber-600 whitespace-nowrap">Needs review</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}