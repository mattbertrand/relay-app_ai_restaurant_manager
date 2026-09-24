import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import PotentialValueCard from "@/components/PotentialValueCard";
import DismissDialog from "@/components/DismissDialog";
import { approveResponse, dismissOpportunity } from "@/lib/opportunityActions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Mail, Phone, User, X, Edit3, Save,
  MessageSquare, Lightbulb, Clock, Sparkles, CheckCircle2, Check, Info,
} from "lucide-react";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const DRAFT_STATUS_STYLES = {
  Draft: "bg-stone-100 text-stone-500 border-stone-200",
  Edited: "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function OpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [opp, setOpp] = useState(null);
  const [activities, setActivities] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [draftUpdated, setDraftUpdated] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [o, acts] = await Promise.all([
        base44.entities.Opportunity.get(id),
        // Only events tied to this specific opportunity — never mixed with
        // activity belonging to other customers or opportunities.
        base44.entities.Activity.filter({ opportunity_id: id }, "-created_date", 50),
      ]);
      setOpp(o);
      setDraft(o.draft_response || "");
      setActivities(acts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const typeLabel = (opp?.type || "").toLowerCase();
  const isApproved = opp?.draft_status === "Approved";

  const startEditing = () => {
    setDraftUpdated(false);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraft(opp.draft_response || "");
  };

  const handleSaveDraft = async () => {
    setActionLoading(true);
    try {
      await base44.entities.Opportunity.update(id, {
        draft_response: draft,
        draft_status: "Edited",
      });
      await base44.entities.Activity.create({
        restaurant_id: opp.restaurant_id,
        opportunity_id: id,
        type: "draft_edited",
        description: `Draft response edited for ${opp.customer_name}'s ${typeLabel}`,
      });
      setOpp({ ...opp, draft_response: draft, draft_status: "Edited" });
      setEditing(false);
      setDraftUpdated(true);
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await approveResponse(opp);
      setOpp({ ...opp, status: "In Progress", draft_status: "Approved" });
      loadData();
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async (reason) => {
    setActionLoading(true);
    try {
      await dismissOpportunity(opp, reason);
      navigate("/opportunities");
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center pt-20">
        <p className="text-muted-foreground">This opportunity could not be found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/opportunities">Back to Opportunities</Link>
        </Button>
      </div>
    );
  }

  const draftStatus = opp.draft_status || "Draft";
  const actionsVisible = opp.status !== "Dismissed" && opp.status !== "Completed";

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto pb-20 md:pb-8">
      <Link
        to="/opportunities"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Opportunities
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
            {opp.type}
          </span>
          <PriorityBadge priority={opp.priority} />
          <StatusBadge status={opp.status} />
        </div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{opp.title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{opp.description}</p>
      </div>

      {/* Approved notice */}
      {isApproved && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="w-4 h-4" /> Response approved
          </div>
          <p className="text-sm text-emerald-700 mt-1">
            {opp.is_demo
              ? "Demo action completed — no external message was actually sent."
              : "The approved response is recorded in Relay. No external message was sent."}
          </p>
          <p className="text-xs text-emerald-600 mt-1.5">
            Connect a communication integration in a future version to send approved responses.
          </p>
        </div>
      )}

      {/* Potential value & source */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <PotentialValueCard opportunity={opp} />
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <MessageSquare className="w-3.5 h-3.5" /> Source
          </div>
          <div className="font-heading text-lg font-semibold text-foreground">
            {opp.source || "—"}
          </div>
        </div>
      </div>

      {/* Customer info */}
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Customer</h2>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">{opp.customer_name}</span>
          </div>
          {opp.customer_email && (
            <div className="flex items-center gap-2.5 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <a href={`mailto:${opp.customer_email}`} className="text-primary hover:underline">
                {opp.customer_email}
              </a>
            </div>
          )}
          {opp.customer_phone && (
            <div className="flex items-center gap-2.5 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{opp.customer_phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Original message */}
      {opp.original_message && (
        <div className="bg-card rounded-xl border border-border p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">Original Message</h2>
          <div className="bg-secondary/40 rounded-lg p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {opp.original_message}
          </div>
        </div>
      )}

      {/* Why Relay flagged this */}
      {opp.why_identified && (
        <div className="bg-accent/5 rounded-xl border border-accent/20 p-5 mb-6">
          <div className="flex items-start gap-2.5">
            <Lightbulb className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Why Relay flagged this</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{opp.why_identified}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recommended action */}
      {opp.recommended_action && (
        <div className="bg-primary/5 rounded-xl border border-primary/20 p-5 mb-6">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Recommended Next Action</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{opp.recommended_action}</p>
            </div>
          </div>
        </div>
      )}

      {/* Draft response */}
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-foreground">
            {editing ? "Edit draft response" : "Draft response"}
          </h2>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                DRAFT_STATUS_STYLES[draftStatus] || DRAFT_STATUS_STYLES.Draft
              )}
            >
              {draftStatus}
            </span>
            {!editing && !isApproved && actionsVisible && (
              <Button variant="ghost" size="sm" onClick={startEditing}>
                <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              This is a draft — it still needs your approval before anything is recorded as approved.
            </p>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={10}
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button onClick={handleSaveDraft} disabled={actionLoading} size="sm">
                <Save className="w-3.5 h-3.5 mr-1.5" /> Save changes
              </Button>
              <Button variant="outline" onClick={cancelEditing} disabled={actionLoading} size="sm">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {draftUpdated && (
              <div className="mb-3 text-xs text-emerald-600 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Draft response updated — it still needs your approval.
              </div>
            )}
            <div className="bg-secondary/40 rounded-lg p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {draft || "No draft prepared yet."}
            </div>
          </>
        )}
      </div>

      {/* Notes */}
      {opp.notes && (
        <div className="bg-card rounded-xl border border-border p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-2">Notes</h2>
          <p className="text-sm text-muted-foreground">{opp.notes}</p>
        </div>
      )}

      {/* Activity history — this opportunity only */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Activity History</h2>
        {(!activities || activities.length === 0) ? (
          <p className="text-sm text-muted-foreground">No activity recorded for this opportunity yet.</p>
        ) : (
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            {activities.map((act) => (
              <div key={act.id} className="flex items-start gap-3 p-4">
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-foreground">{act.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(act.created_date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {actionsVisible && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3">
            {!isApproved && (
              <>
                <Button onClick={handleApprove} disabled={actionLoading} className="flex-1">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Approve Response
                </Button>
                <Button variant="outline" onClick={startEditing} disabled={actionLoading} className="flex-1">
                  <Edit3 className="w-4 h-4 mr-2" /> Edit
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              onClick={() => setDismissOpen(true)}
              disabled={actionLoading}
              className="text-muted-foreground"
            >
              <X className="w-4 h-4 mr-2" /> Dismiss
            </Button>
          </div>
          {opp.is_demo && !isApproved && (
            <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              Demo mode: approving records the response in Relay. No external message is actually sent.
            </p>
          )}
        </div>
      )}

      <DismissDialog
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        title={opp.title}
        onConfirm={handleDismiss}
        loading={actionLoading}
      />
    </div>
  );
}