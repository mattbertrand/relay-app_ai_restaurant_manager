import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getRestaurantId } from "@/lib/format";
import ReviewSourceCard from "@/components/reviews/ReviewSourceCard";
import ReviewCard from "@/components/reviews/ReviewCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { RefreshCw, Star } from "lucide-react";
import BackToToday from "@/components/BackToToday";
import { PROVIDER_META, UPCOMING_PROVIDERS, sourceMetaFor } from "@/lib/reviewProviders";
import { cn } from "@/lib/utils";

// Attention filters: what kind of response this review got (a recorded
// response is NOT the same as the underlying issue being resolved).
const FILTERS = [
  { id: "all", label: "All" },
  { id: "attention", label: "Needs Attention" },
  { id: "responded", label: "Response Recorded" },
  { id: "resolved", label: "Resolved" },
];

// Workflow filters: the attention lifecycle (New → In Progress → Resolved).
const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "New", label: "New" },
  { id: "In Progress", label: "In Progress" },
  { id: "Resolved", label: "Resolved" },
];

// The Reviews list state (the selected filter) survives navigation.
const REVIEWS_CONTEXT_KEY = "relay-reviews-context";

function matchesFilter(review, filter, lifecycle) {
  if (filter === "all") {
    // Lifecycle filter inside All Reviews: New shows only reviews the manager
    // hasn't seen yet; Resolved ones are gone from New once resolved.
    if (lifecycle === "New") return review.manager_status === "New";
    if (lifecycle === "In Progress") return review.manager_status === "In Progress";
    if (lifecycle === "Resolved") return review.manager_status === "Resolved";
    return true;
  }
  if (filter === "attention") {
    return (
      ["New", "In Progress"].includes(review.manager_status) &&
      ["Opportunity", "Attention"].includes(review.classification)
    );
  }
  if (filter === "responded") return review.response_status === "published";
  if (filter === "resolved") return review.manager_status === "Resolved";
  return true;
}

export default function Reviews() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sources, setSources] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [counts, setCounts] = useState({ all: 0, attention: 0, responded: 0, resolved: 0, new: 0, in_progress: 0 });
  // The selected filter survives navigation: leave the list and come back,
  // and the manager lands on the same filter they chose (e.g. Needs Attention).
  const [filter, setFilter] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(REVIEWS_CONTEXT_KEY) || "null");
      return saved && saved.filter ? saved.filter : "all";
    } catch (e) {
      return "all";
    }
  });
  // The lifecycle filter (New / Resolved inside All Reviews) survives
  // navigation together with the list filter.
  const [lifecycle, setLifecycle] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(REVIEWS_CONTEXT_KEY) || "null");
      return saved && saved.lifecycle ? saved.lifecycle : "all";
    } catch (e) {
      return "all";
    }
  });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(REVIEWS_CONTEXT_KEY, JSON.stringify({ filter, lifecycle }));
    } catch (e) {
      /* storage unavailable */
    }
  }, [filter, lifecycle]);

  const loadData = useCallback(async () => {
    const rid = getRestaurantId(user);
    if (!rid) return;
    try {
      const [srcs, page, cAll, cAttention, cResponded, cResolved, cNew, cInProgress] = await Promise.all([
        base44.entities.ReviewSource.filter({ restaurant_id: rid }, null, 10),
        base44.entities.Review.filter({ restaurant_id: rid }, { sort: "-first_seen_at", limit: 50 }),
        base44.entities.Review.count({ restaurant_id: rid }),
        base44.entities.Review.count({
          restaurant_id: rid,
          manager_status: { $in: ["New", "In Progress"] },
          classification: { $in: ["Opportunity", "Attention"] },
        }),
        base44.entities.Review.count({ restaurant_id: rid, response_status: "published" }),
        base44.entities.Review.count({ restaurant_id: rid, manager_status: "Resolved" }),
        base44.entities.Review.count({ restaurant_id: rid, manager_status: "New" }),
        base44.entities.Review.count({ restaurant_id: rid, manager_status: "In Progress" }),
      ]);
      setSources(srcs || []);
      setReviews((page && page.items) || []);
      setCounts({ all: cAll, attention: cAttention, responded: cResponded, resolved: cResolved, new: cNew, in_progress: cInProgress });
    } catch (err) {
      console.error(err);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runSync = async (provider) => {
    if (syncing) return;
    setSyncing(true);
    try {
      const payload = provider === "demo" ? { provider: "demo" } : provider === "google" ? { provider: "google" } : {};
      const res = await base44.functions.invoke("reviewSync", payload);
      const data = res.data || {};
      const s = (data.sources || [])[0];
      const err = (s && s.error) || (!s && data.error);
      if (err) {
        toast({ title: "Can't connect yet", description: err, variant: "destructive" });
      } else if (s) {
        const newCount = s.newReviews || 0;
        toast({
          title: "Review sync complete",
          description: newCount
            ? `${newCount} new review${newCount === 1 ? "" : "s"} — ${s.flagged || 0} flagged for attention, ${s.draftsCreated || 0} draft${(s.draftsCreated || 0) === 1 ? "" : "s"} prepared.`
            : "Everything is up to date.",
        });
      }
      await loadData();
    } catch (err) {
      console.error(err);
      toast({ title: "Sync failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  if (!sources || !reviews) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const sourceLabelById = {};
  sources.forEach((s) => {
    const meta = sourceMetaFor(s);
    const loc = s.provider_location_name || null;
    sourceLabelById[s.id] = loc ? `${meta.label} · ${loc}` : meta.label;
  });
  const googleSource = sources.find((s) => s.provider === "google");
  const demoSource = sources.find((s) => s.provider === "demo");
  const demoReviewCount = reviews.filter((r) => r.is_demo).length;
  const filtered = reviews.filter((r) => matchesFilter(r, filter, lifecycle));

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto pb-20 md:pb-8">
      <BackToToday label="Reviews" />
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">Reviews</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Customer reviews monitored for what actually needs your attention.
          </p>
        </div>
        <Button onClick={() => runSync()} disabled={syncing}>
          <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} /> {syncing ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      <h2 className="text-sm font-semibold text-foreground mb-2">Review sources</h2>
      <div className="grid gap-3 mb-6">
        <ReviewSourceCard
          meta={PROVIDER_META.google}
          source={googleSource}
          onAction={() => runSync("google")}
          busy={syncing}
          note="Google Business Profile API access isn't configured yet — the connect button activates once Google OAuth is available."
        />
        <ReviewSourceCard
          meta={demoSource ? sourceMetaFor(demoSource) : PROVIDER_META.demo}
          source={demoSource}
          onAction={() => runSync("demo")}
          busy={syncing}
          reviewCount={demoSource ? demoReviewCount : undefined}
        />
        <div className="grid sm:grid-cols-3 gap-3">
          {UPCOMING_PROVIDERS.map((id) => (
            <ReviewSourceCard key={id} meta={PROVIDER_META[id]} source={null} onAction={null} busy={false} />
          ))}
        </div>
      </div>

      {/* Sticky, stable filter container: both rows always occupy the same
          space, so changing a filter only replaces the results below — the
          page never jumps or resizes. */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 mb-3 bg-background/95 backdrop-blur-sm border-b border-border/60 space-y-2">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                filter === f.id
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label} ({counts[f.id]})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => {
            const inactive = filter !== "all";
            return (
              <button
                key={s.id}
                type="button"
                disabled={inactive}
                title={inactive ? "Status filters apply within All" : undefined}
                onClick={() => setLifecycle(s.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  inactive && "opacity-40 cursor-not-allowed",
                  !inactive && lifecycle === s.id
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
                {!inactive && s.id === "New" && counts.new ? ` (${counts.new})` : ""}
                {!inactive && s.id === "In Progress" && counts.in_progress ? ` (${counts.in_progress})` : ""}
                {!inactive && s.id === "Resolved" && counts.resolved ? ` (${counts.resolved})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        filter === "all" ? (
          <div className="bg-card rounded-xl border border-border p-10 text-center">
            <div className="w-10 h-10 rounded-full bg-secondary mx-auto flex items-center justify-center mb-3">
              <Star className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No reviews yet. Reviews from your connected providers will appear here.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">
            {filter === "attention"
              ? "Nothing needs attention right now."
              : filter === "responded"
              ? "No published responses yet."
              : lifecycle === "New"
              ? "No new reviews right now."
              : lifecycle === "In Progress"
              ? "No in-progress reviews right now."
              : "No resolved reviews yet."}
          </p>
        )
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              sourceLabel={
                sourceLabelById[r.review_source_id] ||
                (PROVIDER_META[r.provider] ? PROVIDER_META[r.provider].label : r.provider)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}