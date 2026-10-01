import React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const CLASS_STYLES = {
  Opportunity: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Attention: "bg-amber-50 text-amber-700 border-amber-200",
  Routine: "bg-stone-100 text-stone-600 border-stone-200",
  Spam: "bg-stone-100 text-stone-500 border-stone-200",
};

export function ClassificationBadge({ classification }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        CLASS_STYLES[classification] || CLASS_STYLES.Routine
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {classification || "Unclassified"}
    </span>
  );
}

const PRIORITY_STYLES = {
  high: "text-red-600 bg-red-50",
  medium: "text-amber-600 bg-amber-50",
  low: "text-stone-500 bg-stone-100",
  informational: "text-stone-500 bg-stone-100",
};

const PRIORITY_LABELS = {
  high: "High",
  medium: "Medium",
  low: "Low",
  informational: "Informational",
};

export function ReviewPriorityBadge({ priority }) {
  const style = PRIORITY_STYLES[priority] || PRIORITY_STYLES.informational;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", style)}>
      {PRIORITY_LABELS[priority] || priority || "Informational"}
    </span>
  );
}

export const REVIEW_CATEGORY_LABELS = {
  positive_feedback: "Positive feedback",
  compliment: "Compliment",
  negative_experience: "Negative experience",
  service_issue: "Service issue",
  food_quality: "Food quality issue",
  staff_issue: "Staff issue",
  cleanliness: "Cleanliness issue",
  reservation_issue: "Reservation issue",
  pricing_value: "Pricing / value complaint",
  policy_complaint: "Policy complaint",
  safety_allergen_concern: "Safety / allergen concern",
  spam_irrelevant: "Spam / irrelevant",
};

export function Stars({ rating }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn("w-3.5 h-3.5", n <= (rating || 0) ? "text-amber-500 fill-amber-500" : "text-stone-300")}
        />
      ))}
    </span>
  );
}