import React from "react";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  "Needs Review": "bg-amber-50 text-amber-700 border-amber-200",
  "Needs Response": "bg-orange-50 text-orange-700 border-orange-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  "Completed": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Dismissed": "bg-stone-100 text-stone-500 border-stone-200",
  "New": "bg-amber-50 text-amber-700 border-amber-200",
  "Resolved": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Responded": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Closed": "bg-stone-100 text-stone-500 border-stone-200",
  "Pending Approval": "bg-amber-50 text-amber-700 border-amber-200",
  "Approved": "bg-blue-50 text-blue-700 border-blue-200",
  "Opportunity": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Reviewed": "bg-stone-100 text-stone-500 border-stone-200",
};

export default function StatusBadge({ status, className }) {
  const style = STATUS_STYLES[status] || "bg-stone-100 text-stone-600 border-stone-200";
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
      style,
      className
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}