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
import RecipientMultiInput, { parseRecipientText, joinNames, joinEmails, allHaveEmails } from "@/components/RecipientMultiInput";

// A follow-up's email draft: To (multiple recipients — saved contacts, saved
// groups, or typed addresses), Cc, Bcc, subject, and body. Drafts are saved
// in Relay only — Relay never sends email. "Record as sent" records that the
// manager sent the email themselves from their own inbox; no external email
// is transmitted.
export default function TaskDraftDialog({ open, onOpenChange, task, onSaved, onRecorded, mode = "draft" }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const restaurantId = getRestaurantId(user);
  const [recipients, setRecipients] = useState([]);
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [seeded, setSeeded] = useState(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [recording, setRecording] = useState(false);

  if (open && task && seeded !== task.id) {
    setSeeded(task.id);
    setRecipients(
      task.draft_recipient_email || task.draft_recipient
        ? parseRecipientText(
            (task.draft_recipient_email || "")
              .split(",")
              .map((e, i) => {
                const names = (task.draft_recipient || "").split(",").map((n) => n.trim());
                const name = names[i] || "";
                const email = e.trim();
                return name ? `${name} <${email}>` : email;
              })
              .join(", ")
          )
        : []
    );
    setCc(parseRecipientText(task.draft_cc || ""));
    setBcc(parseRecipientText(task.draft_bcc || ""));
    setSubject(task.draft_subject || "");
    setBody(task.draft_email || "");
  }

  if (!open || !task) return null;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const patch = {
        draft_recipient: joinNames(recipients),
        draft_recipient_email: joinEmails(recipients),
        draft_cc: joinEmails(cc),
        draft_bcc: joinEmails(bcc),
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
        recipient: joinNames(recipients) || (task.draft_recipient || "").split(",")[0].trim(),
      });
      const updated = (res.data && res.data.task) || null;
      if (updated) {
        setSubject(updated.draft_subject || "");
        setBody(updated.draft_email || "");
        if (updated.draft_recipient_email || updated.draft_recipient) {
          setRecipients(
            parseRecipientText(
              (updated.draft_recipient_email || "")
                .split(",")
                .map((e, i) => {
                  const names = (updated.draft_recipient || "").split(",").map((n) => n.trim());
                  const name = names[i] || "";
                  const email = e.trim();
                  return name ? `${name} <${email}>` : email;
                })
                .join(", ")
            )
          );
        }
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
    if (!allHaveEmails(recipients)) {
      toast({
        title: "Email address required",
        description: "Relay doesn't have a real address for every recipient and won't invent one.",
        variant: "destructive",
      });
      return;
    }
    setRecording(true);
    try {
      const res = await base44.functions.invoke("recordEmailSent", {
        task_id: task.id,
        recipients: recipients.map((r) => ({ name: r.name || "", email: (r.email || "").trim() })),
        cc: joinEmails(cc),
        bcc: joinEmails(bcc),
        subject: subject.trim(),
        body,
      });
      const updated =
        (res.data && res.data.task) || {
          ...task,
          draft_recipient: joinNames(recipients),
          draft_recipient_email: joinEmails(recipients),
          draft_cc: joinEmails(cc),
          draft_bcc: joinEmails(bcc),
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

  const busy = saving || recording || regenerating;
  const emailOk = allHaveEmails(recipients);

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
            <Label className="text-xs text-muted-foreground">To — type a name or address, or pick a saved contact or group</Label>
            <RecipientMultiInput
              restaurantId={restaurantId}
              value={recipients}
              onChange={setRecipients}
              disabled={busy}
              placeholder="e.g. Keith, All Managers, keith@example.com"
              autoFocus
            />
            {recipients.some((r) => !r.email) && (
              <p className="text-xs text-amber-700">
                Email address required — Relay doesn't have a real address for every recipient and won't invent one.
                Enter the addresses before this email can be recorded as sent.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cc</Label>
            <RecipientMultiInput restaurantId={restaurantId} value={cc} onChange={setCc} disabled={busy} placeholder="Add cc recipients" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bcc</Label>
            <RecipientMultiInput restaurantId={restaurantId} value={bcc} onChange={setBcc} disabled={busy} placeholder="Add bcc recipients" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" disabled={busy} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Email body</Label>
            <textarea
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm min-h-[200px] resize-y leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="The email body…"
              disabled={busy}
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
          <Button variant="outline" size="sm" onClick={regenerate} disabled={busy}>
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