import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import StatusBadge from "@/components/StatusBadge";
import {
  ClassificationBadge,
  ReviewPriorityBadge,
  Stars,
  REVIEW_CATEGORY_LABELS,
} from "@/components/reviews/ReviewBadges";
import { PROVIDER_META } from "@/lib/reviewProviders";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft, Edit3, Save, Lightbulb, BookOpen, Sparkles, CheckCircle2,
  RotateCcw, Clock, ExternalLink, RefreshCw, AlertTriangle, Info, MessageSquareReply,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { activityLabel, isUserFacingActivity } from "@/lib/activityLabels";
import { cn } from "@/lib/utils";
import { setUnsavedChanges, clearUnsavedChanges } from "@/lib/unsavedChanges";

const RESPONSE_STATUS = {
  no_response_needed: { label: "No response needed", cls: "bg-stone-100 text-stone-500 border-stone-200" },
  draft_ready: { label: "Draft ready", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  manager_edited: { label: "Manager edited", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  published: { label: "Published", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  publication_failed: { label: "Publication failed", cls: "bg-red-50 text-red-700 border-red-200" },
};

export default function ReviewDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [review, setReview] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [reanalyzeOpen, setReanalyzeOpen] = useState(false);
  const [source, setSource] = useState(null);

  const loadReview = useCallback(async () => {
    try {
      const r = await base44.entities.Review.get(id);
      setReview(r);
      setDraft(r.draft_response || "");
      if (r.review_source_id) {
        try {
          setSource(await base44.entities.ReviewSource.get(r.review_source_id));
        } catch (e) {
          setSource(null);
        }
      }
      setActivities(await base44.entities.Activity.filter({ review_id: id }, "-created_date", 50));
      // Opening a New review counts as the manager picking it up — attention
      // moves to In Progress, never to Resolved.
      if (r.manager_status === "New") {
        await base44.entities.Review.update(id, { manager_status: "In Progress" });
        await base44.entities.Activity.create({
          restaurant_id: r.restaurant_id,
          review_id: id,
          type: "review_reviewed",
          description: "Manager picked this review up for handling.",
          is_demo: r.is_demo,
        });
        setReview({ ...r, manager_status: "In Progress" });
        setActivities(await base44.entities.Activity.filter({ review_id: id }, "-created_date", 50));
      }
    } catch (err) {
      console.error(err);
      setReview(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  const handleSaveDraft = async () => {
    if (actionLoading) return false;
    setActionLoading(true);
    try {
      await base44.entities.Review.update(id, {
        draft_response: draft,
        draft_edited: true,
        ...(review.response_status !== "published" ? { response_status: "manager_edited" } : {}),
      });
      await base44.entities.Activity.create({
        restaurant_id: review.restaurant_id,
        review_id: id,
        type: "draft_edited",
        description: `Public response draft edited for ${review.reviewer_name}'s review.`,
        is_demo: review.is_demo,
      });
      setEditing(false);
      await loadReview();
      return true;
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't save your changes", description: "Please try again.", variant: "destructive" });
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // Block navigation away while the draft editor has unsaved edits —
  // the shared guard offers to save them first.
  useEffect(() => {
    if (!editing || draft === (review?.draft_response || "")) return;
    setUnsavedChanges({
      isDirty: () => true,
      save: async () => {
        const ok = await handleSaveDraft();
        if (!ok) throw new Error("Save failed");
      },
    });
    return () => clearUnsavedChanges();
  });

  const handleReanalyze = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await base44.functions.invoke("reanalyzeReview", { review_id: id });
      const d = res.data || {};
      toast({
        title: "Re-analyzed with current profile",
        description: `Classified as ${d.classification}, priority ${d.priority}.`,
      });
      await loadReview();
    } catch (err) {
      console.error(err);
      toast({ title: "Re-analysis failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await base44.functions.invoke("reviewPublishResponse", { review_id: id, confirm: true });
      const d = res.data || {};
      if (d.published) {
        toast({
          title: review.is_demo ? "Response published (demo)" : "Response published",
          description: review.is_demo
            ? "Recorded in Relay's history only — no live connection was contacted."
            : "Your response is now live on Google.",
        });
      } else {
        toast({ title: "Publication failed", description: d.error || "Please try again.", variant: "destructive" });
      }
      setPublishOpen(false);
      await loadReview();
    } catch (err) {
      console.error(err);
      toast({ title: "Publication failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (status) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const patch = { manager_status: status };
      if (status === "Resolved") patch.resolved_at = new Date().toISOString();
      await base44.entities.Review.update(id, patch);
      await base44.entities.Activity.create({
        restaurant_id: review.restaurant_id,
        review_id: id,
        type: status === "Resolved" ? "review_resolved" : "review_reopened",
        description: status === "Resolved" ? "Review marked Resolved." : "Review reopened.",
        is_demo: review.is_demo,
      });
      await loadReview();
    } catch (err) {
      console.error(err);
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
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

  if (!review) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center pt-20">
        <p className="text-muted-foreground">This review could not be found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/reviews">Back to Reviews</Link>
        </Button>
      </div>
    );
  }

  const providerMeta = PROVIDER_META[review.provider] || { label: review.provider };
  const locationLabel = !review.is_demo && source && source.provider_location_name ? source.provider_location_name : null;
  const isResolved = review.manager_status === "Resolved";
  const expired = !!review.content_expired;
  const canPublish =
    !!review.draft_response && review.response_status !== "published" && !expired;
  const responseMeta = RESPONSE_STATUS[review.response_status] || RESPONSE_STATUS.no_response_needed;

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto pb-20 md:pb-8">
      <Link
        to="/reviews"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Reviews
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Stars rating={review.rating} />
          <span className="text-sm font-medium text-foreground">{review.reviewer_name || "Unknown reviewer"}</span>
          <span className="text-xs text-muted-foreground">
            {providerMeta.label}
            {review.is_demo ? " · Demo review data" : locationLabel ? ` · ${locationLabel}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <ClassificationBadge classification={review.classification} />
          <ReviewPriorityBadge priority={review.priority} />
          <StatusBadge status={review.manager_status} />
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
              responseMeta.cls
            )}
          >
            {responseMeta.label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {review.category && <span>{REVIEW_CATEGORY_LABELS[review.category] || review.category}</span>}
          {review.category && <span>·</span>}
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Posted {review.review_created_at ? formatDateTime(review.review_created_at) : "—"}
          </span>
        </div>
      </div>

      {/* Expired provider content — durable operational metadata remains */}
      {expired && (
        <div className="mb-6 rounded-xl border border-stone-200 bg-stone-50 p-4 md:p-5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-stone-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Provider content expired</p>
              <p className="text-sm text-muted-foreground mt-1">
                The review's content was cleared under the provider's data-retention policy. Relay's classification and
                status are preserved — the content is re-retrieved on the next sync.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Review content */}
      {!expired && (
        <div className="bg-card rounded-xl border border-border p-5 mb-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground">Review</h2>
            {review.source_url && (
              <a
                href={review.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View at source
              </a>
            )}
          </div>
          <div className="bg-secondary/40 rounded-lg p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {review.review_text || "(No text)"}
          </div>
          {review.owner_response && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <MessageSquareReply className="w-3.5 h-3.5" /> Existing owner response
              </p>
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {review.owner_response}
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                Relay considers this existing response when determining whether another public response is needed. An
                existing response does not by itself mean the underlying issue is resolved.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Why Relay flagged this */}
      {review.why_flagged && (
        <div className="bg-accent/5 rounded-xl border border-accent/20 p-5 mb-6">
          <div className="flex items-start gap-2.5">
            <Lightbulb className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Why this matters</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{review.why_flagged}</p>
            </div>
          </div>
        </div>
      )}

      {/* Restaurant Profile context used */}
      {review.knowledge_used && (
        <div className="bg-card rounded-xl border border-border p-5 mb-6">
          <div className="flex items-start gap-2.5">
            <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Restaurant Profile context</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{review.knowledge_used}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recommended action */}
      {review.recommended_action && (
        <div className="bg-primary/5 rounded-xl border border-primary/20 p-5 mb-6">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Recommended Next Action</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{review.recommended_action}</p>
            </div>
          </div>
        </div>
      )}

      {/* Publication failure */}
      {review.response_status === "publication_failed" && review.publish_error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 md:p-5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Response publication failed</p>
              <p className="text-sm text-red-700 mt-1">{review.publish_error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Draft response */}
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-foreground">{editing ? "Edit public response" : "Draft public response"}</h2>
          <div className="flex items-center gap-2">
            {!editing && !expired && review.response_status !== "published" && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
            )}
            {!editing && !expired && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (review.draft_edited ? setReanalyzeOpen(true) : handleReanalyze())}
                disabled={actionLoading}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Re-analyze
              </Button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              This is a draft — it is only published when you explicitly publish it.
            </p>
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} className="resize-none" />
            <div className="flex gap-2">
              <Button onClick={handleSaveDraft} disabled={actionLoading} size="sm">
                <Save className="w-3.5 h-3.5 mr-1.5" /> Save changes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setDraft(review.draft_response || "");
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-secondary/40 rounded-lg p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {expired
              ? "Provider content expired — run a sync to re-retrieve this review before responding."
              : review.draft_response || "No public response is needed for this review."}
          </div>
        )}
      </div>

      {/* Published notice */}
      {review.response_status === "published" && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="w-4 h-4" /> Response published
          </div>
          <p className="text-sm text-emerald-700 mt-1">
            {review.is_demo
              ? "Demo review — the response was recorded in Relay's history only; no live connection was contacted."
              : `Published ${review.published_at ? formatDateTime(review.published_at) : ""}. Publishing a response does not resolve the underlying issue.`}
          </p>
        </div>
      )}

      {/* Lifecycle actions */}
      {isResolved ? (
        <div className="mb-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:p-5 mb-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="w-4 h-4" /> Resolved — no further action required.
            </div>
          </div>
          <Button variant="outline" onClick={() => handleStatusChange("In Progress")} disabled={actionLoading}>
            <RotateCcw className="w-4 h-4 mr-2" /> Reopen
          </Button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {canPublish && (
            <Button onClick={() => setPublishOpen(true)} disabled={actionLoading} className="flex-1">
              <ExternalLink className="w-4 h-4 mr-2" /> Publish Response
            </Button>
          )}
          <Button variant="secondary" onClick={() => handleStatusChange("Resolved")} disabled={actionLoading} className="flex-1">
            <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Resolved
          </Button>
        </div>
      )}
      {review.is_demo && !isResolved && (
        <p className="text-xs text-muted-foreground mt-1 mb-6 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          Demo mode: publishing records the response in Relay only — no live connection is contacted.
        </p>
      )}

      {/* Activity history — this review only */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Activity History</h2>
          <span className="text-xs text-muted-foreground">Most recent first</span>
        </div>
        {activities.filter(isUserFacingActivity).length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded for this review yet.</p>
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

      {/* Explicit publish confirmation — Relay never publishes on its own */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{review.is_demo ? "Publish response (demo)" : `Publish response to ${providerMeta.label}`}</DialogTitle>
            <DialogDescription>
              {review.is_demo
                ? "This is demo review data. The response will be recorded in Relay's activity history only — no live connection is contacted."
                : `Your response will be published publicly to ${providerMeta.label} under this review. Relay never publishes without your explicit approval.`}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-secondary/40 rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
            {review.draft_response}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={actionLoading}>
              {review.is_demo ? "Publish (demo)" : "Publish response"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-analysis confirmation — never overwrite a manager-edited draft silently */}
      <Dialog open={reanalyzeOpen} onOpenChange={setReanalyzeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-analyze this review?</DialogTitle>
            <DialogDescription>
              Re-analysis uses the current Restaurant Profile and this review's current state. Your edited draft will be
              preserved — a newly generated draft will not replace it. The event is recorded in this review's Activity
              History.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReanalyzeOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setReanalyzeOpen(false);
                handleReanalyze();
              }}
              disabled={actionLoading}
            >
              Re-analyze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}