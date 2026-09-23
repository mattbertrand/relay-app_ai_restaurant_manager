import React, { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const REASONS = ["Not relevant", "Already handled", "Not a good fit", "Duplicate", "Other"];

export default function DismissDialog({ open, onOpenChange, title, onConfirm, loading }) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dismiss this opportunity?</AlertDialogTitle>
          <AlertDialogDescription>
            "{title}" will be marked as dismissed and removed from your needs-attention list. You can still find it under Dismissed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-1">
          <p className="text-sm font-medium text-foreground mb-2">
            Reason <span className="text-muted-foreground font-normal">(optional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(reason === r ? "" : r)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  reason === r
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <AlertDialogFooter className="mt-5">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button onClick={() => onConfirm(reason)} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Dismissing…
              </>
            ) : (
              "Dismiss"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}