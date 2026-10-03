import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ReclassifyDialog from "@/components/ReclassifyDialog";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Manager action: re-analyze a conversation with the CURRENT Restaurant
// Knowledge. Two explicit gates: a manager-edited draft must be confirmed
// before a new draft replaces it, and when a worked-on opportunity gets
// reclassified the manager chooses what happens to it. No external email is
// ever sent.
export default function ReanalyzeButton({
  conversationId,
  opportunityId,
  onChanged,
  label = "Re-analyze",
  variant = "ghost",
  size = "sm",
  className,
}) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [choice, setChoice] = useState(null);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const { toast } = useToast();

  const run = async ({ confirm = false, reclassChoice = null } = {}) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("reanalyzeConversation", {
        conversation_id: conversationId || undefined,
        opportunity_id: opportunityId || undefined,
        confirm: confirm === true,
        reclass_choice: reclassChoice || undefined,
      });
      const data = res.data || {};
      if (data.requiresConfirmation) {
        setConfirmOpen(true);
        return;
      }
      if (data.requiresChoice) {
        setChoice({ opportunityTitle: data.opportunityTitle, newClassification: data.newClassification });
        setChoiceOpen(true);
        return;
      }
      if (data.error) {
        toast({ title: "Re-analysis failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Analysis regenerated",
        description: "Re-analyzed with the current Restaurant Profile. The previous analysis is preserved.",
      });
      if (onChanged) onChanged();
    } catch (err) {
      console.error(err);
      toast({ title: "Re-analysis failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={busy}
        onClick={() => run()}
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        )}
        {label}
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-analyze this message?</AlertDialogTitle>
            <AlertDialogDescription>
              This response has been edited by a manager. Re-analyzing will generate a new draft based on the
              current Restaurant Profile. The edited version is preserved and recoverable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { setConfirmOpen(false); run({ confirm: true }); }}>Re-analyze</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ReclassifyDialog
        open={choiceOpen}
        onOpenChange={setChoiceOpen}
        opportunityTitle={choice && choice.opportunityTitle}
        newClassification={choice && choice.newClassification}
        busy={busy}
        onChoice={(c) => {
          setChoiceOpen(false);
          run({ confirm: true, reclassChoice: c });
        }}
      />
    </>
  );
}