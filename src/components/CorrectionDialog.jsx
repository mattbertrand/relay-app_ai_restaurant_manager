import React, { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "should_be_opportunity", label: "Should be an Opportunity" },
  { value: "should_be_attention", label: "Should be Attention" },
  { value: "should_be_routine", label: "Should be Routine" },
  { value: "should_be_administrative", label: "Should be Administrative" },
  { value: "should_be_spam", label: "Should be Spam" },
];

// Lightweight restaurant-specific feedback: the manager corrects a
// classification, and the correction becomes context for future analysis for
// THIS restaurant only.
export default function CorrectionDialog({ open, onOpenChange, convo, onDone }) {
  const [correction, setCorrection] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCorrection("");
      setNote("");
      setSaving(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!correction || !convo) return;
    setSaving(true);
    try {
      await base44.entities.RestaurantFeedback.create({
        restaurant_id: convo.restaurant_id,
        conversation_id: convo.id,
        opportunity_id: convo.opportunity_id || "",
        subject: convo.subject || "",
        correction,
        note: note.trim() || "",
      });
      // Handling the correction also handles the inbox message
      await base44.entities.Conversation.update(convo.id, { status: "Reviewed" });
      onOpenChange(false);
      if (onDone) onDone();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wrong classification?</DialogTitle>
          <DialogDescription>
            Tell Relay how this message should have been classified. Your correction is remembered for
            future emails to your restaurant only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setCorrection(opt.value)}
              className={cn(
                "w-full text-left px-3.5 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                correction === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Relay got this wrong because… (optional)
          </p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="resize-none"
            placeholder="e.g. We know this sender — it's a regular customer, not a vendor"
          />
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!correction || saving}>
            Save correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}