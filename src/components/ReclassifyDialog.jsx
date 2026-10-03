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
// stale. The manager chooses what happens to it.
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
          <AlertDialogTitle>Re-analyze this message?</AlertDialogTitle>
          <AlertDialogDescription>
            The re-analysis classifies this message as "{newClassification || "not an opportunity"}" — no longer a
            revenue opportunity. The linked opportunity{opportunityTitle ? ` "${opportunityTitle}"` : ""} was already
            worked on. What should happen to it?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col gap-2">
          <Button className="w-full" disabled={busy} onClick={() => onChoice("resolve")}>
            Resolve the old opportunity
          </Button>
          <Button variant="outline" className="w-full" disabled={busy} onClick={() => onChoice("refresh")}>
            Update it to the new classification
          </Button>
          <Button variant="ghost" className="w-full" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}