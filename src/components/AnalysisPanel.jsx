import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { categoryLabel } from "@/lib/classification";
import { cn } from "@/lib/utils";

// The full analysis stored at import time — classification, Relay's reasoning,
// and which Restaurant Profile facts applied — shown on the conversation card
// immediately. Collapsible so the Inbox stays scannable; expanded by default
// whenever fresh analysis exists. The suggested reply (children) lives inside.
export default function AnalysisPanel({ convo, children, className }) {
  const [open, setOpen] = useState(true);

  const classification =
    convo.analysis_status === "Opportunity"
      ? "Revenue opportunity"
      : convo.analysis_status;

  return (
    <div className={cn("mt-2 rounded-lg bg-muted/40 border border-border", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-xs font-medium text-muted-foreground">
          Analysis
          <span className="ml-2 text-foreground font-medium">{classification}</span>
          {convo.category ? (
            <span className="text-muted-foreground"> · {categoryLabel(convo.category)}</span>
          ) : null}
          {convo.intent ? <span className="text-muted-foreground"> · {convo.intent}</span> : null}
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2.5">
          {convo.why_flagged && (
            <div>
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
          {children}
        </div>
      )}
    </div>
  );
}