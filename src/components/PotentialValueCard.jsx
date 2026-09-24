import React from "react";
import { DollarSign } from "lucide-react";
import ValueConfidenceBadge from "@/components/ValueConfidenceBadge";
import { formatValueRange } from "@/lib/format";

export default function PotentialValueCard({ opportunity }) {
  const { estimated_value_min, estimated_value_max, value_basis, value_confidence } = opportunity;
  const hasValue = estimated_value_min || estimated_value_max;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <DollarSign className="w-3.5 h-3.5" /> Potential value
        </div>
        <ValueConfidenceBadge confidence={value_confidence} />
      </div>
      <div className={hasValue ? "font-heading text-lg font-semibold text-foreground" : "text-sm text-muted-foreground"}>
        {hasValue ? formatValueRange(estimated_value_min, estimated_value_max) : "Not enough information"}
      </div>
      {value_basis && (
        <div className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
          <p className="font-medium mb-0.5">How this was estimated:</p>
          <p>{value_basis}</p>
        </div>
      )}
      {hasValue && (
        <p className="text-xs text-muted-foreground mt-3 pt-2.5 border-t border-border/60 leading-relaxed">
          This is an estimate based on the information available — not a confirmed amount.
        </p>
      )}
    </div>
  );
}