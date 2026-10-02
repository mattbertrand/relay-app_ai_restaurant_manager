import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

const OPTIONS = [
  {
    value: "7d",
    label: "Past 7 days",
    recommended: true,
    description: "Recommended for most restaurants. Includes recent conversations that may still need attention.",
  },
  {
    value: "now",
    label: "Starting now",
    description: "Only new emails received after Relay is connected.",
  },
  {
    value: "30d",
    label: "Past 30 days",
    description: "Includes a larger history of recent restaurant activity.",
  },
  {
    value: "custom",
    label: "Choose a date",
    description: "Import emails received on or after a date you select.",
  },
];

// A short human-readable label for the stored initial-import choice.
export function initialImportLabel(setup) {
  if (!setup || !setup.window) return null;
  if (setup.window === "now") return "Starting now";
  if (setup.window === "7d") return "Past 7 days";
  if (setup.window === "30d") return "Past 30 days";
  if (setup.window === "custom" && setup.from_date) {
    const d = new Date(`${setup.from_date}T00:00:00`);
    if (!isNaN(d.getTime())) {
      return `From ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return `From ${setup.from_date}`;
  }
  return null;
}

export default function GmailImportSetup({ initialSelection, importing, progress, onImport }) {
  const [choice, setChoice] = useState(initialSelection?.window || "7d");
  const [fromDate, setFromDate] = useState(initialSelection?.from_date || "");

  if (importing) {
    return (
      <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Analyzing recent email…
        </p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Relay is reviewing your selected email history and identifying conversations that may need attention.
        </p>
        {progress && !progress.error && (
          <p className="text-xs text-muted-foreground mt-2">
            {progress.imported} message{progress.imported === 1 ? "" : "s"} imported · {progress.analyzed} analyzed
            {progress.opportunities
              ? ` · ${progress.opportunities} opportunit${progress.opportunities === 1 ? "y" : "ies"} identified`
              : ""}
          </p>
        )}
        {progress && progress.error && <p className="text-xs text-destructive mt-2">{progress.error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-sm font-semibold text-foreground">How much email should Relay analyze?</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
        Relay can review recent email to identify active conversations and opportunities. You don't need to import your
        entire mailbox.
      </p>

      <div className="mt-3 space-y-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setChoice(opt.value)}
            className={
              "w-full text-left rounded-lg border p-3 transition-colors " +
              (choice === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")
            }
          >
            <span className="flex items-center gap-2">
              <span
                className={
                  "w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 " +
                  (choice === opt.value ? "border-primary bg-primary" : "border-muted-foreground/40")
                }
              />
              <span className="text-sm font-medium text-foreground">{opt.label}</span>
              {opt.recommended && (
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              )}
            </span>
            <span className="block text-xs text-muted-foreground mt-1 pl-5">{opt.description}</span>
          </button>
        ))}
      </div>

      {choice === "custom" && (
        <div className="mt-3 pl-5">
          <label className="text-xs font-medium text-foreground block mb-1">Received on or after</label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-44" />
        </div>
      )}

      <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 p-3">
        <p className="text-xs font-medium text-foreground">
          After setup, Relay will continue monitoring new incoming emails automatically.
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Your selection only controls the initial email history Relay reviews.
        </p>
      </div>

      <Button
        size="sm"
        className="mt-3"
        onClick={() => onImport(choice, fromDate)}
        disabled={choice === "custom" && !fromDate}
      >
        {choice === "now" ? "Continue without importing" : "Start initial import"}
      </Button>
    </div>
  );
}