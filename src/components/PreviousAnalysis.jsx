import React from "react";
import { History } from "lucide-react";

// The analysis/draft as it stood before a re-analysis — kept on the record so
// nothing is silently overwritten and the previous version stays recoverable.
export default function PreviousAnalysis({ text, className }) {
  if (!text) return null;
  return (
    <div className={"rounded-lg border border-border bg-muted/40 p-3.5 " + (className || "")}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <History className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <p className="text-xs font-medium text-muted-foreground">
          Previous analysis — generated using an earlier Restaurant Profile state
        </p>
      </div>
      <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{text}</div>
    </div>
  );
}