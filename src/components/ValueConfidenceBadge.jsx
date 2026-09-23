import React from "react";
import { cn } from "@/lib/utils";

const CONFIDENCE_STYLES = {
  High: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-stone-100 text-stone-500 border-stone-200",
};

export default function ValueConfidenceBadge({ confidence, className }) {
  if (!confidence) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap",
        CONFIDENCE_STYLES[confidence] || CONFIDENCE_STYLES.Low,
        className
      )}
    >
      {confidence} confidence
    </span>
  );
}