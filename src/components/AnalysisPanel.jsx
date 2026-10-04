import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronDown, ChevronUp } from "lucide-react";
import RichDraft from "@/components/RichDraft";
import { categoryLabel } from "@/lib/classification";
import { cn } from "@/lib/utils";

// THE single analysis section for an analyzed email — classification,
// Relay's reasoning, Restaurant Knowledge used, recommended next action, and
// the draft, all from the analysis stored at import time. Collapsed by
// default so the Inbox stays scannable; the card's own line above already
// shows the classification summary. Previous analysis is a separate, collapsed
// control — never a competing panel.
export default function AnalysisPanel({ convo, children, className }) {
  const [open, setOpen] = useState(false);
  // An Opportunity-classified email keeps its draft on the linked opportunity
  // (single source of truth) — fetched only when the manager expands this.
  const [oppDraft, setOppDraft] = useState(null); // null = not loaded yet
  const needsOppDraft = open && !convo.draft_response && !!convo.opportunity_id;

  useEffect(() => {
    if (!needsOppDraft || oppDraft !== null) return;
    let alive = true;
    base44.entities.Opportunity.get(convo.opportunity_id)
      .then((o) => { if (alive) setOppDraft((o && o.draft_response) || ""); })
      .catch(() => { if (alive) setOppDraft(""); });
    return () => { alive = false; };
  }, [needsOppDraft, oppDraft, convo.opportunity_id]);

  return (
    <div className={cn("rounded-lg bg-muted/40 border border-border", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-xs font-medium text-muted-foreground">Analysis</span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
              Classification
            </p>
            <p className="text-xs text-foreground">
              {convo.analysis_status === "Opportunity" ? "Revenue opportunity" : convo.analysis_status}
              {convo.category ? ` — ${categoryLabel(convo.category)}` : ""}
              {convo.intent ? ` · ${convo.intent}` : ""}
            </p>
          </div>
          {convo.why_flagged && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                Reasoning
              </p>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{convo.why_flagged}</p>
            </div>
          )}
          {convo.knowledge_used && (
            <div>
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Restaurant Knowledge Used
                </p>
                <span className="text-[10px] font-medium text-primary bg-primary/5 border border-primary/20 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  Source: Restaurant Profile
                </span>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{convo.knowledge_used}</p>
            </div>
          )}
          {convo.recommended_action && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                Recommended Next Action
              </p>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{convo.recommended_action}</p>
            </div>
          )}
          {children}
          {!children && needsOppDraft && oppDraft && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                Draft
              </p>
              <RichDraft text={oppDraft} className="text-xs text-muted-foreground" emptyLabel="" />
              <p className="text-[11px] text-muted-foreground mt-1">
                Managed on the related opportunity — edits and approval happen there.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}