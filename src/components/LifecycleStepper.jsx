import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { lifecycleStatus } from "@/lib/opportunityLifecycle";

const STEPS = ["New", "In Progress", "Resolved"];

export default function LifecycleStepper({ status, className }) {
  const stage = lifecycleStatus(status);
  const activeIndex = STEPS.indexOf(stage);

  if (activeIndex === -1) {
    return (
      <div className={cn("inline-flex items-center gap-1.5 text-xs text-stone-500", className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
        Dismissed — removed from the active workflow
      </div>
    );
  }

  return (
    <div className={cn("flex items-center w-full", className)}>
      {STEPS.map((step, i) => {
        const done = i < activeIndex;
        const current = i === activeIndex;
        return (
          <React.Fragment key={step}>
            {i > 0 && (
              <div className={cn("flex-1 h-0.5 mx-1", done ? "bg-primary/60" : "bg-border")} />
            )}
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold border",
                  done
                    ? "bg-primary text-primary-foreground border-primary"
                    : current
                      ? "bg-primary/10 text-primary border-primary"
                      : "bg-card text-muted-foreground border-border"
                )}
              >
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  current ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}