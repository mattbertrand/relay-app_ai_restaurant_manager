import React from "react";
import { cn } from "@/lib/utils";

export default function StatCard({ icon: Icon, label, value, sublabel, accent = "default", className }) {
  const accents = {
    default: "text-foreground",
    primary: "text-primary",
    accent: "text-accent",
    emerald: "text-emerald-600",
    blue: "text-blue-600",
  };
  const iconBg = {
    default: "bg-muted",
    primary: "bg-primary/10",
    accent: "bg-accent/10",
    emerald: "bg-emerald-50",
    blue: "bg-blue-50",
  };
  return (
    <div className={cn("bg-card rounded-xl border border-border p-5", className)}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", iconBg[accent])}>
            <Icon className={cn("w-4.5 h-4.5", accents[accent])} />
          </div>
        )}
      </div>
      <div className={cn("text-2xl font-semibold font-heading", accents[accent])}>{value}</div>
      {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
    </div>
  );
}