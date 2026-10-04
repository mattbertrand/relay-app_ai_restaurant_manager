import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import PotentialValueCard from "@/components/PotentialValueCard";
import DismissDialog from "@/components/DismissDialog";
import {
  approveResponse,
  dismissOpportunity,
  resolveOpportunity,
  reopenOpportunity,
} from "@/lib/opportunityActions";
import { NEW_STATUSES, lifecycleStatus, nextStepFor } from "@/lib/opportunityLifecycle";
import LifecycleStepper from "@/components/LifecycleStepper";
import BackToToday from "@/components/BackToToday";
import PreviousAnalysis from "@/components/PreviousAnalysis";
import ReanalyzeButton from "@/components/ReanalyzeButton";
import ResolveDialog from "@/components/ResolveDialog";
import RichDraft from "@/components/RichDraft";
import RichDraftEditor from "@/components/RichDraftEditor";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Mail, Phone, User, X, Edit3, Save,
  MessageSquare, Lightbulb, Clock, Sparkles, CheckCircle2, Check, Info, RotateCcw,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { activityLabel, isUserFacingActivity } from "@/lib/activityLabels";
import { cn } from "@/lib/utils";
import { setUnsavedChanges, clearUnsavedChanges } from "@/lib/unsavedChanges";
import { htmlToPlainText } from "@/lib/draftText";

const DRAFT_STATUS_STYLES = {
  Draft: "bg-stone-100 text-stone-500 border-stone-200",
  Edited: "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function OpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [opp, setOpp] = useState(null);
  const [activities, setActivities] = useState(null);
  const [linkedConversations, setLinkedConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [draftUpdated, setDraftUpdated] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);

  // Contextual navigation: opened from the Inbox returns to the Inbox.
  const fromInbox = location.state?.backTo === "inbox";
  const sourceConvo = (linkedConversations || [])[0];

  // An opportunity's history is exactly: its own events, plus the events of
  // the conversation (email thread) that started it. Nothing restaurant-wide.
  const fetchActivities = useCallback(async (convos) => {
    const [oppActs, convActs] = await Promise.all([
      base44.entities.Activity.filter({ opportunity_id: id }, "-created_date", 50),
      Promise.all(
        (convos || []).map((c) =>
          base44.entities.Activity.filter({ conversation_id: c.id }, "-created_date", 50).catch(() => [])
        )
      ),
    ]);
    const seen = new Set();
    return [...(oppActs || []), ...convActs.flat()]
      .filter((a) => !seen.has(a.id) && seen.add(a.id))
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [id]);

  const loadData = useCallback(async () => {
    try {
      const [o, convos] = await Promise.all([
        base44.entities.Opportunity.get(id),
        base44.entities.Conversation.filter({ opportunity_id: id }, null, 10),
      ]);
      setOpp(o);
      setDraft(o.draft_response || "");
      setLinkedConversations(convos || []);
      setActivities(await fetchActivities(convos || []));

      // Viewing an opportunity is NOT a manager action — the lifecycle only
      // moves New → In Progress through an explicit manager action (editing or
      // approving a draft), recorded in the Activity History.
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, fetchActivities]);

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
    if (actionLoading) return false;
    setActionLoading(true);
    try {
      // Editing and saving a draft is an explicit manager action — it moves a
      // New opportunity to In Progress, and the transition is recorded in the
      // Activity History so every status change is attributable.
      const statusUpdate = NEW_STATUSES.includes(opp.status) ? { status: "In Progress" } : {};
      await base44.entities.Opportunity.update(id, {
        draft_response: draft,
        draft_status: "Edited",
        ...statusUpdate,
      });
      await base44.entities.Activity.create({
        restaurant_id: opp.restaurant_id,
        opportunity_id: id,
        type: "draft_edited",
        description: `Draft response edited for ${opp.customer_name}'s ${typeLabel}`,
      });
      if (statusUpdate.status) {
        await base44.entities.Activity.create({
          restaurant_id: opp.restaurant_id,
          opportunity_id: id,
          type: "status_changed",
          description: "Opportunity moved to In Progress — draft response edited",
        });
      }
      setOpp({ ...opp, draft_response: draft, draft_status: "Edited", ...statusUpdate });
      setEditing(false);
      setDraftUpdated(true);
      return true;
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // Block navigation away while the draft editor has unsaved edits —
  // the shared guard offers to save them first.
  useEffect(() => {
    if (!editing || htmlToPlainText(draft) === htmlToPlainText(opp?.draft_response || "")) return;
    setUnsavedChanges({
      isDirty: () => true,
      save: async () => {
        const ok = await handleSaveDraft();
        if (!ok) throw new Error("Save failed");
      },
    });
    return () => clearUnsavedChanges();
  });

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

  const handleResolve = async (note) => {
    setActionLoading(true);
    try {
      await resolveOpportunity(opp, note);
      setResolveOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    setActionLoading(true);
    try {
      await reopenOpportunity(opp);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
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
  const stage = lifecycleStatus(opp.status);
  const isResolved = stage === "Resolved";
  const isDismissed = stage === "Dismissed";
  const actionsVisible = !isResolved && !isDismissed;

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto pb-20 md:pb-8">
      {fromInbox ? (
        <button
          onClick={() => navigate("/inbox")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Inbox
        </button>
      ) : (
        <Link
          to="/opportunities"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Opportunities
        </Link>
      )}

      <BackToToday label="Opportunities" />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
            {opp.type}
          </span>
          <PriorityBadge priority={opp.priority} />
          <StatusBadge status={lifecycleStatus(opp.status)} />
        </div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{opp.title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{opp.description}</p>
      </div>

      {/* Lifecycle & next step */}
      <div className="mb-6">
        <div className="bg-card rounded-xl border border-border p-4 md:p-5">
          <LifecycleStepper status={opp.status} />
        </div>
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4 md:p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">What's next</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{nextStepFor(opp)}</p>
        </div>
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

      {/* Original message + a direct path back to the source email */}
      {(opp.original_message || sourceConvo) && (
        <div className="bg-card rounded-xl border border-border p-5 mb-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground">Original Message</h2>
            {sourceConvo && (
              <button
                onClick={() =>
                  navigate("/inbox", { state: { focusConversationId: sourceConvo.id } })
                }
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
              >
                <Mail className="w-3.5 h-3.5" /> View source email in Inbox
              </button>
            )}
          </div>
          <div className="bg-secondary/40 rounded-lg p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {opp.original_message || sourceConvo.message}
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

      {/* Previous analysis — preserved when the analysis was regenerated */}
      {opp.previous_analysis && (
        <div className="mb-6">
          <PreviousAnalysis text={opp.previous_analysis} />
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
            {!editing && !isApproved && actionsVisible && !opp.is_demo && (
              <ReanalyzeButton
                opportunityId={id}
                onChanged={loadData}
                label="Re-analyze with current knowledge"
              />
            )}
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
            <RichDraftEditor value={draft} onChange={setDraft} />
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
            <RichDraft
              text={draft}
              className="bg-secondary/40 rounded-lg p-4 text-sm text-foreground leading-relaxed"
            />
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

      {/* Activity history — this opportunity only, newest first, real
          timestamps, technical bookkeeping hidden */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Activity History</h2>
          <span className="text-xs text-muted-foreground">Most recent first</span>
        </div>
        {(activities || []).filter(isUserFacingActivity).length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded for this opportunity yet.</p>
        ) : (
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            {activities.filter(isUserFacingActivity).map((act) => (
              <div key={act.id} className="flex items-start gap-3 p-4">
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-medium text-foreground">{activityLabel(act)}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{act.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(act.created_date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {isResolved ? (
        <div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:p-5 mb-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="w-4 h-4" /> Resolved — no further action required.
            </div>
            {opp.notes && (
              <p className="text-xs text-emerald-700 mt-1">Note: {opp.notes}</p>
            )}
          </div>
          <Button variant="outline" onClick={handleReopen} disabled={actionLoading}>
            <RotateCcw className="w-4 h-4 mr-2" /> Reopen
          </Button>
        </div>
      ) : actionsVisible && (
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
              variant="secondary"
              onClick={() => setResolveOpen(true)}
              disabled={actionLoading}
              className="flex-1"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Resolved
            </Button>
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

      <ResolveDialog
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        title={opp.title}
        onConfirm={handleResolve}
        loading={actionLoading}
      />

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