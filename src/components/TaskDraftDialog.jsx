import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Mail, Loader2, Save, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { taskActivity } from "@/lib/taskSource";

// A follow-up task's draft email, edited in a proper space: To, Subject, and
// the full body. The draft is saved in Relay only — Relay never sends email
// automatically. Regeneration rebuilds the draft from the manager's original
// instruction and the source item.
export default function TaskDraftDialog({ open, onOpenChange, task, onSaved }) {
  const { toast } = useToast();
  const [recipient, setRecipient] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [seeded, setSeeded] = useState(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  if (open && task && seeded !== task.id) {
    setSeeded(task.id);
    setRecipient(task.draft_recipient || "");
    setRecipientEmail(task.draft_recipient_email || "");
    setSubject(task.draft_subject || "");
    setBody(task.draft_email || "");
  }
  if (!open && seeded) {
    // keep the last seeded values until reopened; harmless
  }

  if (!open || !task) return null;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const patch = {
        draft_recipient: recipient.trim(),
        draft_recipient_email: recipientEmail.trim(),
        draft_subject: subject.trim(),
        draft_email: body,
        draft_edited: true,
      };
      await base44.entities.Task.update(task.id, patch);
      await taskActivity(
        { ...task, ...patch },
        "email_draft_edited",
        `Email draft edited for "${task.title}" — saved in Relay only, nothing sent.`
      ).catch(() => {});
      toast({ title: "Draft saved", description: "Saved in Relay only — no email has been sent." });
      onOpenChange(false);
      if (onSaved) onSaved({ ...task, ...patch });
    } catch (err) {
      toast({ title: "Couldn't save the draft", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const res = await base44.functions.invoke("createFollowUp", {
        task_id: task.id,
        regenerate_draft: true,
        recipient: recipient.trim(),
      });
      const updated = (res.data && res.data.task) || null;
      if (updated) {
        setSubject(updated.draft_subject || "");
        setBody(updated.draft_email || "");
        setRecipient(updated.draft_recipient || recipient);
        setRecipientEmail(updated.draft_recipient_email || recipientEmail);
        if (onSaved) onSaved(updated);
      }
      toast({ title: "Draft regenerated", description: "The manager's instruction and context are preserved — edit freely." });
    } catch (err) {
      toast({ title: "Couldn't regenerate the draft", description: "Please try again.", variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" /> Draft email
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To (name or role)</Label>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Who should receive it — e.g. Banquet Manager"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Recipient email address</Label>
            <Input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="e.g. keith@yourrestaurant.com"
            />
            {recipient.trim() && !recipientEmail.trim() && (
              <p className="text-xs text-amber-700">
                Email address required — Relay doesn't have one for {recipient.trim()} and won't invent it. Enter the
                real address before this draft could ever be sent.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Email body</Label>
            <textarea
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm min-h-[220px] resize-y leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="The email body…"
            />
          </div>
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Saved in Relay only — no email has been sent.
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={regenerate} disabled={regenerating || saving}>
            {regenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Regenerating…
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerate
              </>
            )}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Save draft
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}