import React from "react";
import { cn } from "@/lib/utils";

const PRIORITY_STYLES = {
  high: "text-red-600 bg-red-50",
  medium: "text-amber-600 bg-amber-50",
  low: "text-stone-500 bg-stone-100",
};

const PRIORITY_LABELS = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export default function PriorityBadge({ priority, className }) {
  const style = PRIORITY_STYLES[priority] || PRIORITY_STYLES.low;
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
      style,
      className
    )}>
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}