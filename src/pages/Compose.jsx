import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import BackToToday from "@/components/BackToToday";
import RecipientMultiInput, { joinNames, joinEmails, allHaveEmails } from "@/components/RecipientMultiInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { getRestaurantId, timeAgo } from "@/lib/format";
import { PenLine, Trash2, Loader2, Save, Send, Mail, RotateCcw } from "lucide-react";

// Relay's compose tool: write an email to any mix of individual recipients,
// saved groups, cc, and bcc. Drafts are saved in Relay only — Relay never
// sends email. "Record as sent" records that the manager sent it themselves
// from their own inbox.
export default function Compose() {
  const { toast } = useToast();
  const { user } = useAuth();
  const restaurantId = getRestaurantId(user);
  const [to, setTo] = useState([]);
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [draftId, setDraftId] = useState(null);
  const [forwardedFrom, setForwardedFrom] = useState("");
  const [drafts, setDrafts] = useState(null);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);

  const loadDrafts = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const page = await base44.entities.EmailDraft.filter(
        { restaurant_id: restaurantId, status: "draft" },
        { sort: "-created_date", limit: 50 }
      );
      setDrafts(page.items || []);
    } catch (e) {
      console.error(e);
      setDrafts([]);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  // Prefill from the Inbox's Forward action.
  useEffect(() => {
    const fid = new URLSearchParams(window.location.search).get("forward");
    if (!fid) return;
    setForwardedFrom(fid);
    base44.entities.Conversation.get(fid)
      .then((convo) => {
        setSubject(`Fwd: ${convo.subject || "(no subject)"}`);
        setBody(
          `---------- Forwarded message ----------\nFrom: ${convo.customer_name || "Unknown"}${
            convo.customer_email ? ` <${convo.customer_email}>` : ""
          }\nSent: ${timeAgo(convo.received_at || convo.created_date)}\nSubject: ${convo.subject || ""}\n\n${
            convo.message || ""
          }`
        );
      })
      .catch(() => {});
  }, []);

  const reset = () => {
    setTo([]);
    setCc([]);
    setBcc([]);
    setSubject("");
    setBody("");
    setDraftId(null);
    setForwardedFrom("");
  };

  const payload = () => ({
    restaurant_id: restaurantId,
    to_names: joinNames(to),
    to_emails: joinEmails(to),
    cc_emails: joinEmails(cc),
    bcc_emails: joinEmails(bcc),
    subject: subject.trim(),
    body,
    forwarded_from: forwardedFrom || null,
  });

  const saveDraft = async () => {
    if (saving || (!subject.trim() && !body.trim())) {
      if (!subject.trim() && !body.trim()) {
        toast({ title: "Nothing to save yet", description: "Add a subject or a message first." });
      }
      return;
    }
    setSaving(true);
    try {
      if (draftId) {
        await base44.entities.EmailDraft.update(draftId, payload());
      } else {
        const created = await base44.entities.EmailDraft.create({ ...payload(), status: "draft" });
        setDraftId(created.id);
      }
      toast({ title: "Draft saved", description: "Saved in Relay only — no email has been sent." });
      await loadDrafts();
    } catch (e) {
      toast({ title: "Couldn't save the draft", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const recordSent = async () => {
    if (recording) return;
    if (!subject.trim()) {
      toast({ title: "Subject required", description: "Add a subject before recording the email as sent." });
      return;
    }
    if (!allHaveEmails(to) || cc.some((r) => !r.email) || bcc.some((r) => !r.email)) {
      toast({
        title: "Email address required",
        description: "Relay doesn't have a real address for every recipient and won't invent one.",
        variant: "destructive",
      });
      return;
    }
    setRecording(true);
    try {
      const label = to.map((r) => `${r.name || r.email} <${r.email}>`).join(", ");
      if (draftId) {
        await base44.entities.EmailDraft.update(draftId, { ...payload(), status: "recorded", recorded_at: new Date().toISOString() });
      } else {
        await base44.entities.EmailDraft.create({ ...payload(), status: "recorded", recorded_at: new Date().toISOString() });
      }
      await base44.entities.Activity.create({
        restaurant_id: restaurantId,
        type: "email_recorded_sent",
        description: `Email recorded as sent in Relay — no external email was sent. To: ${label}.${
          joinEmails(cc) ? ` Cc: ${joinEmails(cc)}.` : ""
        }${joinEmails(bcc) ? ` Bcc: ${joinEmails(bcc)}.` : ""} Subject: "${subject.trim()}".`,
      });
      toast({ title: "Email recorded as sent", description: "Recorded in Relay — no external email was sent." });
      reset();
      await loadDrafts();
    } catch (e) {
      toast({ title: "Couldn't record the email", description: "Please try again.", variant: "destructive" });
    } finally {
      setRecording(false);
    }
  };

  const loadDraft = (d) => {
    setDraftId(d.id);
    setForwardedFrom(d.forwarded_from || "");
    setTo((d.to_emails || d.to_names || "")
      .split(",")
      .map((e, i) => {
        const names = (d.to_names || "").split(",").map((n) => n.trim());
        const email = e.trim();
        if (!email) return null;
        const name = names[i] || "";
        return name ? { name, email } : { name: email, email };
      })
      .filter(Boolean));
    setCc((d.cc_emails || "").split(",").map((e) => e.trim()).filter(Boolean).map((e) => ({ name: e, email: e })));
    setBcc((d.bcc_emails || "").split(",").map((e) => e.trim()).filter(Boolean).map((e) => ({ name: e, email: e })));
    setSubject(d.subject || "");
    setBody(d.body || "");
  };

  const removeDraft = async (d) => {
    try {
      await base44.entities.EmailDraft.delete(d.id);
      if (draftId === d.id) reset();
      await loadDrafts();
    } catch (e) {
      toast({ title: "Couldn't remove the draft", description: "Please try again.", variant: "destructive" });
    }
  };

  const recordDraftRow = async (d) => {
    setRecording(true);
    try {
      await base44.entities.EmailDraft.update(d.id, { status: "recorded", recorded_at: new Date().toISOString() });
      await base44.entities.Activity.create({
        restaurant_id: restaurantId,
        type: "email_recorded_sent",
        description: `Email recorded as sent in Relay — no external email was sent. To: ${d.to_names || d.to_emails || "recipient"}. Subject: "${d.subject}".`,
      });
      if (draftId === d.id) reset();
      toast({ title: "Email recorded as sent", description: "Recorded in Relay — no external email was sent." });
      await loadDrafts();
    } catch (e) {
      toast({ title: "Couldn't record the email", description: "Please try again.", variant: "destructive" });
    } finally {
      setRecording(false);
    }
  };

  const busy = saving || recording;

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto pb-20 md:pb-8">
      <BackToToday label="Compose" />
      <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground mt-4 mb-1 flex items-center gap-2">
        <PenLine className="w-6 h-6 text-primary" /> Compose
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Write to individuals, saved groups, cc, or bcc. Relay never sends email — you send it from your own inbox and
        record it here.
      </p>

      <div className="bg-card rounded-xl border border-border p-5 md:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {draftId ? "Editing draft" : "New email"}
          </h2>
          {(draftId || to.length || cc.length || bcc.length || subject || body) && !busy && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={reset}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> New
            </Button>
          )}
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To — type a name or address, or pick a saved contact or group</Label>
            <RecipientMultiInput
              restaurantId={restaurantId}
              value={to}
              onChange={setTo}
              disabled={busy}
              placeholder="e.g. Keith, All Managers, keith@example.com"
            />
            {(to.some((r) => !r.email) || cc.some((r) => !r.email) || bcc.some((r) => !r.email)) && (
              <p className="text-xs text-amber-700">
                Email address required — Relay doesn't have a real address for every recipient and won't invent one.
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
            Saved in Relay only — no email has been sent.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 mt-4 flex-wrap">
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={busy}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Save draft
          </Button>
          <Button size="sm" onClick={recordSent} disabled={busy || !subject.trim() || !allHaveEmails(to)}>
            {recording ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
            Record as sent
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground text-right mt-1">
          Record as sent records that you sent it from your own inbox — no external email is transmitted.
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 md:p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground mb-1">Saved drafts</h2>
        <p className="text-sm text-muted-foreground mb-4">Emails still being written — nothing has been sent.</p>
        {!drafts ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
            No saved drafts yet.
          </p>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {drafts.map((d) => (
              <div key={d.id} className="flex items-start gap-3 px-3 py-2.5">
                <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{d.subject || "(no subject)"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {d.to_names || d.to_emails || "No recipients yet"}
                    {d.cc_emails ? ` · cc ${d.cc_emails}` : ""}
                    {d.bcc_emails ? ` · bcc ${d.bcc_emails}` : ""}
                    {" · "}
                    {timeAgo(d.created_date)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                  <Button variant="outline" size="sm" onClick={() => loadDraft(d)}>
                    Load
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => recordDraftRow(d)} disabled={recording}>
                    Record as sent
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => removeDraft(d)} title="Delete draft">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}