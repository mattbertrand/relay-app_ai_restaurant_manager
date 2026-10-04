import React from "react";
import { cn } from "@/lib/utils";

// The analysis stored at import time — Relay's reasoning and which Restaurant
// Profile facts applied — shown compactly on every live email card with
// analysis. Classification sits in the card's own line; the draft lives in the
// existing reply panel. Non-collapsible, one clean block.
export default function AnalysisPanel({ convo, className }) {
  if (!convo.why_flagged && !convo.knowledge_used) return null;

  return (
    <div className={cn("mt-3 rounded-lg bg-muted/40 border border-border p-3", className)}>
      {convo.why_flagged && (
        <div className={convo.knowledge_used ? "mb-2.5" : ""}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
            Relay's reasoning
          </p>
          <p className="text-xs text-muted-foreground whitespace-pre-line">{convo.why_flagged}</p>
        </div>
      )}
      {convo.knowledge_used && (
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Restaurant Knowledge
            </p>
            <span className="text-[10px] font-medium text-primary bg-primary/5 border border-primary/20 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              Source: Restaurant Profile
            </span>
          </div>
          <p className="text-xs text-muted-foreground whitespace-pre-line">{convo.knowledge_used}</p>
        </div>
      )}
    </div>
  );
}