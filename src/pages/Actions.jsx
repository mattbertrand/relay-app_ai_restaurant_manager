import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { approveResponse } from "@/lib/opportunityActions";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { formatValueRange, timeAgo } from "@/lib/format";
import { CheckSquare, Check, X, Clock, FileText, Bell, User } from "lucide-react";
import BackToToday from "@/components/BackToToday";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "Pending Approval", "Approved", "Completed", "Dismissed"];

const ACTION_ICONS = {
  "Draft response": FileText,
  "Follow-up reminder": Bell,
  "Follow-up": Bell,
  "Customer follow-up": User,
  "Opportunity review": CheckSquare,
};

export default function Actions() {
  const [actions, setActions] = useState(null);
  const [opportunities, setOpportunities] = useState(null);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [acts, opps] = await Promise.all([
        base44.entities.Action.list("-created_date", 100),
        base44.entities.Opportunity.list("-created_date", 100),
      ]);
      setActions(acts);
      setOpportunities(opps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const oppMap = (opportunities || []).reduce((acc, o) => { acc[o.id] = o; return acc; }, {});
  const filtered = (actions || []).filter((a) => filter === "All" || a.status === filter);

  const updateAction = async (action, newStatus) => {
    setBusy(action.id);
    try {
      // Approving a draft response is the same approval workflow as the
      // opportunity page — keep the underlying data consistent.
      if (newStatus === "Completed" && action.type === "Draft response" && action.opportunity_id) {
        const opp = oppMap[action.opportunity_id];
        if (opp) {
          await approveResponse(opp);
          loadData();
          return;
        }
      }
      const updates = { status: newStatus };
      if (newStatus === "Completed") updates.completed_at = new Date().toISOString();
      await base44.entities.Action.update(action.id, updates);

      // Log activity
      const opp = action.opportunity_id ? oppMap[action.opportunity_id] : null;
      await base44.entities.Activity.create({
        restaurant_id: action.restaurant_id,
        opportunity_id: action.opportunity_id || "",
        action_id: action.id,
        type: newStatus === "Completed" ? "response_approved" : "opportunity_dismissed",
        description: newStatus === "Completed"
          ? `Action completed: ${action.description}`
          : `Action dismissed: ${action.description}`,
      });

      loadData();
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
      <BackToToday label="Actions" />
      <div className="mb-6">
        <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">Actions</h1>
        <p className="text-muted-foreground text-sm mt-1">Recommended actions from Relay. Everything requires your approval.</p>
      </div>


      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground hover:text-foreground border-border"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No actions here"
          description="Relay will recommend actions like draft responses and follow-ups as opportunities come in."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((action) => {
            const Icon = ACTION_ICONS[action.type] || CheckSquare;
            const opp = action.opportunity_id ? oppMap[action.opportunity_id] : null;
            const isPending = action.status === "Pending Approval";
            return (
              <div key={action.id} className="bg-card rounded-xl border border-border p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">{action.type}</span>
                      <StatusBadge status={action.status} />
                      {action.requires_approval && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" /> Needs approval
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground mt-1">{action.description}</p>
                    {action.type === "Follow-up" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {action.due_date
                          ? `Due ${action.due_date}`
                          : "Needs scheduling — no date was promised"}
                      </p>
                    )}
                    {opp && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Related: <span className="text-foreground font-medium">{opp.title}</span>
                        {" · "}
                        {formatValueRange(opp.estimated_value_min, opp.estimated_value_max)}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">{timeAgo(action.created_date)}</p>

                    {isPending && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => updateAction(action, "Completed")}
                          disabled={busy === action.id}
                        >
                          <Check className="w-3.5 h-3.5 mr-1.5" /> Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateAction(action, "Dismissed")}
                          disabled={busy === action.id}
                        >
                          <X className="w-3.5 h-3.5 mr-1.5" /> Dismiss
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}