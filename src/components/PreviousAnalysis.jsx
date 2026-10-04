import React, { useState } from "react";
import { History, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// The analysis/draft as it stood before a re-analysis — preserved on the
// record so nothing is silently overwritten. Secondary by design: collapsed
// by default so it never competes with the current analysis; the manager
// expands it only when they want to compare.
export default function PreviousAnalysis({ text, className }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className={cn("rounded-lg border border-border bg-muted/40", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-3.5 py-2 text-left"
      >
        <History className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground flex-1">
          Previous analysis — generated using an earlier Restaurant Profile state
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {text}
        </div>
      )}
    </div>
  );
}