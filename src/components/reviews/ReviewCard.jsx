import React from "react";
import { Link } from "react-router-dom";
import { MessageSquareReply } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import {
  ClassificationBadge,
  ReviewPriorityBadge,
  Stars,
  REVIEW_CATEGORY_LABELS,
} from "@/components/reviews/ReviewBadges";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ReviewCard({ review, sourceLabel }) {
  const expired = !!review.content_expired;
  return (
    <Link
      to={`/reviews/${review.id}`}
      className="block bg-card rounded-xl border border-border p-4 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Stars rating={review.rating} />
          <span className="text-sm font-medium text-foreground">{review.reviewer_name || "Unknown reviewer"}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(review.review_created_at)}</span>
          {sourceLabel && <span className="text-xs text-muted-foreground">· {sourceLabel}</span>}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {review.is_demo && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              Demo
            </span>
          )}
          {expired && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 bg-stone-100 border border-stone-200 rounded px-1.5 py-0.5">
              Content expired
            </span>
          )}
          <ReviewPriorityBadge priority={review.priority} />
        </div>
      </div>
      <p className="text-sm text-foreground leading-relaxed line-clamp-2">
        {expired ? "Provider content expired — it will be re-retrieved on the next sync." : review.review_text || "(No text)"}
      </p>
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        <ClassificationBadge classification={review.classification} />
        {review.category && (
          <span className="text-xs text-muted-foreground">{REVIEW_CATEGORY_LABELS[review.category] || review.category}</span>
        )}
        {review.owner_response && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
            <MessageSquareReply className="w-3.5 h-3.5" /> Response posted
          </span>
        )}
        <span className="ml-auto">
          <StatusBadge status={review.manager_status} />
        </span>
      </div>
    </Link>
  );
}