import React from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Shown when a re-analysis reclassifies a message the manager already worked
// on — the old opportunity is never silently deleted, refreshed, or left
// stale. The manager chooses what happens to it, and can always cancel and
// leave everything exactly as it is.
export default function ReclassifyDialog({
  open,
  onOpenChange,
  opportunityTitle,
  newClassification,
  busy,
  onChoice,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>How should the existing opportunity be handled?</AlertDialogTitle>
          <AlertDialogDescription>
            Re-analysis now classifies this message as "{newClassification || "not an opportunity"}" — no longer a
            revenue opportunity. The linked opportunity{opportunityTitle ? ` "${opportunityTitle}"` : ""} was already
            worked on. Nothing changes until you choose — Cancel leaves the opportunity and its draft exactly as they are.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col gap-2">
          <Button className="w-full h-auto py-2.5 flex-col items-start gap-0.5" disabled={busy} onClick={() => onChoice("refresh")}>
            <span className="text-sm font-medium">Update &amp; Regenerate</span>
            <span className="text-xs font-normal opacity-80 text-left">
              Keep the opportunity and update it to the new classification — the existing draft will be regenerated from the current Restaurant Profile.
            </span>
          </Button>
          <Button variant="outline" className="w-full h-auto py-2.5 flex-col items-start gap-0.5" disabled={busy} onClick={() => onChoice("resolve")}>
            <span className="text-sm font-medium">Resolve Old Opportunity</span>
            <span className="text-xs font-normal opacity-80 text-left">
              Mark it Resolved and record in its history that re-analysis determined the original classification no longer applies.
            </span>
          </Button>
          <Button variant="ghost" className="w-full" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}