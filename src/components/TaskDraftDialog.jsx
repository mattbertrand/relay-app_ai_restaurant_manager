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
import { Mail, Loader2, Save, RefreshCw, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { taskActivity } from "@/lib/taskSource";
import { useAuth } from "@/lib/AuthContext";
import { getRestaurantId } from "@/lib/format";
import RecipientInput from "@/components/RecipientInput";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A follow-up's email draft: To (with saved-contact suggestions), email
// address, subject, and body. Drafts are saved in Relay only — Relay never
// sends email. "Record as sent" records that the manager sent the email
// themselves from their own inbox; no external email is transmitted.
export default function TaskDraftDialog({ open, onOpenChange, task, onSaved, onRecorded, mode = "draft" }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const restaurantId = getRestaurantId(user);
  const [recipient, setRecipient] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [seeded, setSeeded] = useState(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [recording, setRecording] = useState(false);

  if (open && task && seeded !== task.id) {
    setSeeded(task.id);
    setRecipient(task.draft_recipient || "");
    setRecipientEmail(task.draft_recipient_email || "");
    setSubject(task.draft_subject || "");
    setBody(task.draft_email || "");
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

  const recordSent = async () => {
    if (recording) return;
    if (!EMAIL_RE.test(recipientEmail.trim())) {
      toast({
        title: "Email address required",
        description: "Relay doesn't have a real address for this recipient and won't invent one.",
        variant: "destructive",
      });
      return;
    }
    setRecording(true);
    try {
      const res = await base44.functions.invoke("recordEmailSent", {
        task_id: task.id,
        to_name: recipient.trim(),
        to_email: recipientEmail.trim(),
        subject: subject.trim(),
        body,
      });
      const updated =
        (res.data && res.data.task) || {
          ...task,
          draft_recipient: recipient.trim(),
          draft_recipient_email: recipientEmail.trim(),
          draft_subject: subject.trim(),
          draft_email: body,
          email_recorded_sent: true,
        };
      toast({ title: "Email recorded as sent", description: "Recorded in Relay — no external email was sent." });
      if (onRecorded) onRecorded(updated);
      else if (onSaved) onSaved(updated);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Couldn't record the email",
        description: (err && err.message) || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRecording(false);
    }
  };

  const emailOk = EMAIL_RE.test(recipientEmail.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" /> {mode === "now" ? "Email now" : "Draft email"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <RecipientInput
              restaurantId={restaurantId}
              name={recipient}
              email={recipientEmail}
              onNameChange={setRecipient}
              onEmailChange={setRecipientEmail}
              disabled={saving || recording || regenerating}
              placeholder="e.g. Keith, Banquet Manager"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Email address</Label>
            <Input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="e.g. keith@example.com"
              disabled={saving || recording || regenerating}
            />
            {recipient.trim() && !recipientEmail.trim() && (
              <p className="text-xs text-amber-700">
                Email address required — Relay doesn't have one for {recipient.trim()} and won't invent it. Enter the
                real address before this email can be recorded as sent.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              disabled={saving || recording || regenerating}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Email body</Label>
            <textarea
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm min-h-[220px] resize-y leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="The email body…"
              disabled={saving || recording || regenerating}
            />
          </div>
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {mode === "now"
              ? "No external email will be sent yet. Relay will record this email as sent."
              : "Saved in Relay only — no email has been sent."}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
          <Button variant="outline" size="sm" onClick={regenerate} disabled={regenerating || saving || recording}>
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
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving || recording}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={save} disabled={saving || recording}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Save draft
            </Button>
            <Button size="sm" onClick={recordSent} disabled={recording || saving || !emailOk || !subject.trim()}>
              {recording ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 mr-1.5" />
              )}
              Record as sent
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground text-right -mt-1">
          Record as sent only records it in Relay — no external email is transmitted.
        </p>
      </DialogContent>
    </Dialog>
  );
}