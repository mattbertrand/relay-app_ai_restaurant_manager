import React from "react";

// Lightweight provenance for a suggested reply: what the customer asked and
// which verified Restaurant Profile facts Relay used (or that the profile
// doesn't contain them). Concise by design — trust, not technical reasoning.
export default function DraftProvenance({ convo }) {
  const points = [];
  if (convo.intent) points.push(`Customer asked about ${convo.intent.toLowerCase()}`);
  if (convo.knowledge_used) points.push(convo.knowledge_used);
  if (!points.length) return null;

  return (
    <div className="mt-3 rounded-lg bg-muted/40 border border-border p-3">
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <p className="text-xs font-medium text-muted-foreground">Why Relay drafted this</p>
        {convo.knowledge_used && (
          <span className="text-[10px] font-medium text-primary bg-primary/5 border border-primary/20 px-1.5 py-0.5 rounded-full whitespace-nowrap">
            Source: Restaurant Profile
          </span>
        )}
      </div>
      <ul className="space-y-1">
        {points.map((p, i) => (
          <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
            <span className="text-border">•</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}