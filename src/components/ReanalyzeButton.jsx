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
import { base44 } from "@/api/base44Client";
import { RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Manager action: re-analyze a conversation with the CURRENT Restaurant
// Knowledge. When the draft was manually edited, the manager must explicitly
// confirm before a new draft replaces it — the edited version stays
// recoverable either way. No external email is ever sent.
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
  const [confirming, setConfirming] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  const run = async (confirm) => {
    if (busy || confirming) return;
    if (confirm) setConfirming(true);
    else setBusy(true);
    try {
      const res = await base44.functions.invoke("reanalyzeConversation", {
        conversation_id: conversationId || undefined,
        opportunity_id: opportunityId || undefined,
        confirm: confirm === true,
      });
      const data = res.data || {};
      if (data.requiresConfirmation) {
        setConfirmOpen(true);
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
      setConfirming(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={busy || confirming}
        onClick={() => run(false)}
      >
        {busy || confirming ? (
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
            <Button onClick={() => { setConfirmOpen(false); run(true); }}>Re-analyze</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}