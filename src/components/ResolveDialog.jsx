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
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NOTE_SUGGESTIONS = [
  "Customer confirmed booking",
  "Issue resolved",
  "Customer responded",
  "Event booked",
  "No further action required",
];

export default function ResolveDialog({ open, onOpenChange, title, onConfirm, loading }) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark this opportunity as resolved?</AlertDialogTitle>
          <AlertDialogDescription>
            "{title}" will be removed from your active workflow and marked as completed — no further
            action will be required.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-1">
          <p className="text-sm font-medium text-foreground mb-2">
            Resolution note <span className="text-muted-foreground font-normal">(optional)</span>
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {NOTE_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setNote(note === s ? "" : s)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  note === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Or add your own note…"
          />
        </div>
        <AlertDialogFooter className="mt-5">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button onClick={() => onConfirm(note)} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Resolving…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Resolved
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}