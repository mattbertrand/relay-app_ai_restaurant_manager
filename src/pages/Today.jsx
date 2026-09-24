import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getRestaurantId, formatValueRange, timeAgo } from "@/lib/format";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import DemoBanner from "@/components/DemoBanner";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { TrendingUp, Bell, DollarSign, CheckCircle2, Target, ArrowRight, Activity as ActivityIcon, Clock, Mail } from "lucide-react";

const ACTIVITY_ICONS = {
  opportunity_identified: Target,
  draft_prepared: Clock,
  response_approved: CheckCircle2,
  follow_up_scheduled: Bell,
  opportunity_reviewed: CheckCircle2,
  opportunity_dismissed: Bell,
  email_received: Mail,
  draft_edited: Clock,
};

export default function Today() {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState(null);
  const [activities, setActivities] = useState(null);
  const [actions, setActions] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [opps, acts, acts2] = await Promise.all([
        base44.entities.Opportunity.list("-created_date", 50),
        base44.entities.Activity.list("-created_date", 15),
        base44.entities.Action.list("-created_date", 50),
      ]);
      setOpportunities(opps);
      setActivities(acts);
      setActions(acts2);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const needsAttention = (opportunities || []).filter(
    (o) => o.status === "Needs Review" || o.status === "Needs Response" || o.status === "Needs Attention"
  );
  const followUpsNeeded = needsAttention.length;
  const completedActions = (actions || []).filter((a) => a.status === "Completed").length;
  const activeOpps = (opportunities || []).filter((o) => o.status !== "Dismissed");
  const potentialMin = activeOpps.reduce((sum, o) => sum + (o.estimated_value_min || 0), 0);
  const potentialMax = activeOpps.reduce((sum, o) => sum + (o.estimated_value_max || 0), 0);

  const hasDemo = (opportunities || []).some((o) => o.is_demo);

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">Today</h1>
        <p className="text-muted-foreground text-sm mt-1">Here's what needs your attention.</p>
      </div>

      {hasDemo && <div className="mb-6"><DemoBanner /></div>}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <StatCard icon={Target} label="Opportunities Found" value={opportunities?.length || 0} accent="primary" />
        <StatCard icon={Bell} label="Follow-ups Needed" value={followUpsNeeded} accent="accent" />
        <StatCard icon={DollarSign} label="Potential Value" value={formatValueRange(potentialMin, potentialMax)} accent="emerald" />
        <StatCard icon={CheckCircle2} label="Completed Actions" value={completedActions} accent="blue" />
      </div>

      {/* Needs Attention */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">Needs Attention</h2>
          <Link to="/opportunities" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {needsAttention.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">You're all caught up</p>
            <p className="text-xs text-muted-foreground mt-1">No opportunities need your attention right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {needsAttention.slice(0, 5).map((opp) => (
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
                    </div>
                    <h3 className="font-medium text-foreground text-sm md:text-base">{opp.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{opp.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">{opp.customer_name} · {timeAgo(opp.created_date)}</p>
                  </div>
                  <div className="flex sm:flex-col sm:items-end gap-2 sm:gap-1">
                    <div className="text-sm font-semibold text-foreground">{formatValueRange(opp.estimated_value_min, opp.estimated_value_max)}</div>
                    <StatusBadge status={opp.status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
        {(!activities || activities.length === 0) ? (
          <EmptyState icon={ActivityIcon} title="No activity yet" description="Actions and updates will appear here as you use Relay." />
        ) : (
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            {activities.map((act) => {
              const Icon = ACTIVITY_ICONS[act.type] || ActivityIcon;
              return (
                <div key={act.id} className="flex items-start gap-3 p-4">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{act.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(act.created_date)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}