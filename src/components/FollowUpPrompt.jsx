import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  X, Loader2, CheckCircle2, Clock, CalendarClock, ArrowLeft, Mail, Plus,
} from "lucide-react";
import { taskWhenLabel } from "@/lib/taskSource";
import TaskDraftDialog from "@/components/TaskDraftDialog";
import RecipientInput from "@/components/RecipientInput";
import { useAuth } from "@/lib/AuthContext";
import { getRestaurantId } from "@/lib/format";
import { todayInTimezone } from "@/lib/format";
import { cn } from "@/lib/utils";

// The follow-up prompt Relay shows after a MEANINGFUL manager action —
// publishing a review response, recording an email reply, moving an
// opportunity to In Progress. Assistant-like, never a task form: pick what
// you want to do, say it in your own words, pick when, done. Shown once per
// action; Relay never re-asks about the same action, and an instruction that
// adjusts an existing follow-up updates that task instead of creating a
// duplicate. Any draft email is saved in Relay only — never sent.

const ACTIONS = [
  { id: "talk", label: "Talk to someone", ask: "Who do you want to talk to, and about what?", placeholder: "e.g. Talk to the managers about this at stand-up" },
  { id: "call", label: "Call someone", ask: "Who do you want to call, and about what?", placeholder: "e.g. Call Josh tomorrow about the Dine & Donate" },
  { id: "email", label: "Email someone", ask: "What should the email be about?", placeholder: "e.g. For tentative Dine & Donate — ask about dates and headcount", email: true },
  { id: "investigate", label: "Investigate / Check", ask: "What do you want to find out?", placeholder: "e.g. Find out why the guest was served the steak well done" },
  { id: "customer", label: "Follow up with customer", ask: "What should you check back on?", placeholder: "e.g. Check back with the customer after we talk to the kitchen" },
  { id: "meeting", label: "Discuss at a meeting", ask: "What should be discussed, and at which meeting?", placeholder: "e.g. Bring this up at the manager meeting" },
  { id: "other", label: "Other", ask: "What do you want to do?", placeholder: "e.g. Check with the owner before Friday" },
];

const TIMEFRAMES = [
  { id: "asap", label: "ASAP" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "This week" },
  { id: "nextweek", label: "Next week" },
  { id: "custom", label: "Custom" },
];

function addDaysIso(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// A quick timeframe chip → a concrete due date. The manager never has to
// give a time; Custom offers one optionally.
export function resolveTimeframe(id, customDate, customTime, today) {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
  const thisWeek = dow >= 1 && dow <= 5 ? addDaysIso(today, 5 - dow) : today;
  const nextWeek = addDaysIso(today, 8 - dow);
  switch (id) {
    case "asap": return { due_date: today, due_time: "", priority: "High" };
    case "today": return { due_date: today, due_time: "", priority: "" };
    case "tomorrow": return { due_date: addDaysIso(today, 1), due_time: "", priority: "" };
    case "week": return { due_date: thisWeek, due_time: "", priority: "" };
    case "nextweek": return { due_date: nextWeek, due_time: "", priority: "" };
    case "custom": return customDate ? { due_date: customDate, due_time: customTime || "", priority: "" } : null;
    default: return null;
  }
}

export default function FollowUpPrompt({ open, onOpenChange, source, headline, question }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const restaurantId = getRestaurantId(user);
  const navigate = useNavigate();
  const [step, setStep] = useState("choose"); // choose → details → confirm
  const [action, setAction] = useState(null);
  const [instruction, setInstruction] = useState("");
  const [recipient, setRecipient] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailMode, setEmailMode] = useState(""); // "" | "later" — how the manager handles an email follow-up
  const [emailNow, setEmailNow] = useState(false);
  const [timeframe, setTimeframe] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  // A plan: when one instruction contains several distinct actions, Relay
  // shows them all and the manager confirms before anything is created.
  const [plan, setPlan] = useState(null);
  const [planInstruction, setPlanInstruction] = useState("");
  const [clarify, setClarify] = useState(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftTask, setDraftTask] = useState(null);
  const [quickInput, setQuickInput] = useState("");
  const inputRef = useRef(null);

  const reset = () => {
    setStep("choose");
    setAction(null);
    setInstruction("");
    setRecipient("");
    setRecipientEmail("");
    setEmailMode("");
    setEmailNow(false);
    setTimeframe("");
    setCustomDate("");
    setCustomTime("");
    setResult(null);
    setPlan(null);
    setPlanInstruction("");
    setClarify(null);
    setDraftOpen(false);
    setDraftTask(null);
    setQuickInput("");
  };

  useEffect(() => {
    if (open) {
      reset();
      setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
    }
  }, [open]);

  const create = async (payload) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("createFollowUp", {
        source_type: source.type,
        source_id: source.id,
        source_label: source.label,
        source_summary: source.summary,
        source_is_demo: !!source.isDemo,
        ...payload,
      });
      const d = res.data || {};
      if (d.no_task) {
        onOpenChange(false);
        return;
      }
      if (d.plan) {
        // Several distinct follow-ups in one instruction — confirm first.
        setPlan(d.tasks || []);
        setPlanInstruction(payload.instruction || "");
        setStep("plan");
        setInstruction("");
        return;
      }
      if (d.needs_clarification) {
        setClarify({ task: d.task, question: d.clarification_question || "When should I remind you?" });
        setStep("details");
      } else {
        setResult(d);
        setStep("confirm");
      }
      setInstruction("");
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't create the follow-up", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // From the details step: the manager's words are the source of truth; the
  // chip they picked is the explicit action and timeframe.
  const createFromDetails = () => {
    if (!action || !instruction.trim()) return;
    const tf = resolveTimeframe(timeframe, customDate, customTime, todayInTimezone());
    if (timeframe === "custom" && !tf) return;
    create({
      instruction: instruction.trim(),
      action_type: action.id,
      recipient: action.email ? recipient.trim() : "",
      recipient_email: action.email ? recipientEmail.trim() : "",
      due_date: (tf && tf.due_date) || "",
      due_time: (tf && tf.due_time) || "",
      priority: (tf && tf.priority) || "",
    });
  };

  // "Email now" — creates the email follow-up right away (no date) and opens
  // the composer. Recording as sent happens in the composer; Relay never
  // transmits the email itself.
  const startEmailNow = async () => {
    if (busy || !instruction.trim()) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("createFollowUp", {
        source_type: source.type,
        source_id: source.id,
        source_label: source.label,
        source_summary: source.summary,
        source_is_demo: !!source.isDemo,
        instruction: instruction.trim(),
        action_type: "email",
        recipient: recipient.trim(),
        recipient_email: recipientEmail.trim(),
      });
      const d = res.data || {};
      if (d.no_task) {
        onOpenChange(false);
        return;
      }
      if (d.plan) {
        setPlan(d.tasks || []);
        setPlanInstruction(instruction.trim());
        setStep("plan");
        setInstruction("");
        return;
      }
      if (d.task) {
        setResult(d);
        setDraftTask(d.task);
        setDraftOpen(true);
        setEmailNow(true);
        setStep("confirm");
        setInstruction("");
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't create the follow-up", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // Direct free-form creation from the choose step (no chip) — Relay parses
  // the whole instruction, as before.
  const submitQuick = () => {
    const q = quickInput.trim();
    if (!q) return;
    create({ instruction: q });
  };

  // Create every follow-up in the confirmed plan — one call, all linked to
  // the same source item, each Email action getting its own draft.
  const createPlan = async () => {
    if (!plan || !plan.length || busy) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("createFollowUp", {
        source_type: source.type,
        source_id: source.id,
        source_label: source.label,
        source_summary: source.summary,
        source_is_demo: !!source.isDemo,
        instruction: planInstruction,
        plan_tasks: plan,
      });
      setResult(res.data || {});
      setPlan(null);
      setPlanInstruction("");
      setStep("confirm");
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't create the follow-ups", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // "Add another follow-up" — same source context, straight back to choosing
  // the next action without starting over.
  const addAnother = () => {
    setResult(null);
    setStep("choose");
    setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
  };

  const answerClarify = async (dueDate, dueTime) => {
    if (!clarify || busy) return;
    setBusy(true);
    try {
      await base44.functions.invoke("createFollowUp", {
        task_id: clarify.task.id,
        due_date: dueDate,
        due_time: dueTime || "",
      });
      setResult({ created_new: false, updated_existing: true, task: { ...clarify.task, due_date: dueDate, due_time: dueTime || "" } });
      setClarify(null);
      setStep("confirm");
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't set the reminder", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const viewFollowUp = () => {
    if (!result || !result.task) return;
    onOpenChange(false);
    navigate("/tasks", { state: { focusTaskId: result.task.id } });
  };

  const today = todayInTimezone();
  const tomorrowDate = addDaysIso(today, 1);

  const chipCls =
    "px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card text-muted-foreground hover:text-foreground transition-colors";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {step === "choose" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{headline}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {question || "Anything else you want to do about this?"}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ACTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setAction(a);
                    setInstruction("");
                    setRecipient("");
                    setTimeframe("");
                    setStep("details");
                  }}
                  className="text-left px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  {a.label}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitQuick();
              }}
            >
              <Input
                ref={inputRef}
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder="Or describe it in your own words…"
                disabled={busy}
              />
              <Button
                type="submit"
                size="sm"
                className="mt-2 w-full"
                disabled={busy || !quickInput.trim()}
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Create Follow-up
              </Button>
            </form>
            {busy && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Working on it…
              </p>
            )}
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
                Skip
              </Button>
            </div>
          </div>
        )}

        {step === "details" && !clarify && action && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep("choose")}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <p className="text-sm font-semibold text-foreground">{action.label}</p>
            </div>
            {action.email && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Who should receive it?</Label>
                <RecipientInput
                  restaurantId={restaurantId}
                  name={recipient}
                  email={recipientEmail}
                  onNameChange={setRecipient}
                  onEmailChange={setRecipientEmail}
                  disabled={busy}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{action.ask}</Label>
              <textarea
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm min-h-[80px] resize-y"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={action.placeholder}
                disabled={busy}
                autoFocus
              />
            </div>
            {action.email ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">How do you want to handle the email?</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={startEmailNow}
                    disabled={busy || !instruction.trim()}
                  >
                    <Mail className="w-3.5 h-3.5 mr-1.5" /> Email now
                  </Button>
                  <Button
                    type="button"
                    variant={emailMode === "later" ? "default" : "outline"}
                    onClick={() => setEmailMode(emailMode === "later" ? "" : "later")}
                    disabled={busy}
                  >
                    <Clock className="w-3.5 h-3.5 mr-1.5" /> Remind me to send it later
                  </Button>
                </div>
                {emailMode === "later" && (
                  <>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {TIMEFRAMES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          disabled={busy}
                          onClick={() => setTimeframe(t.id)}
                          className={cn(
                            chipCls,
                            timeframe === t.id && "bg-primary text-primary-foreground border-primary"
                          )}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {timeframe === "custom" && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                        <Input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} placeholder="Optional time" />
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      {busy ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Working on it…
                        </p>
                      ) : (
                        <span />
                      )}
                      <Button
                        size="sm"
                        onClick={createFromDetails}
                        disabled={busy || !instruction.trim() || (timeframe === "custom" && !customDate)}
                      >
                        Create Follow-up
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">When?</Label>
                  <div className="flex flex-wrap gap-2">
                    {TIMEFRAMES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        disabled={busy}
                        onClick={() => setTimeframe(t.id)}
                        className={cn(
                          chipCls,
                          timeframe === t.id && "bg-primary text-primary-foreground border-primary"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {timeframe === "custom" && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                      <Input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} placeholder="Optional time" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1">
                  {busy ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Working on it…
                    </p>
                  ) : (
                    <span />
                  )}
                  <Button
                    size="sm"
                    onClick={createFromDetails}
                    disabled={busy || !instruction.trim() || (timeframe === "custom" && !customDate)}
                  >
                    Create Follow-up
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {clarify && step === "details" && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">{clarify.question}</p>
            <p className="text-xs text-muted-foreground">
              Relay can't detect when someone arrives or when something is finished — pick a time and it will
              remind you then. Your trigger is saved with the task: “{clarify.task.reminder_note}”.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => answerClarify(today, "")} className={chipCls}>
                Today
              </button>
              <button type="button" disabled={busy} onClick={() => answerClarify(tomorrowDate, "")} className={chipCls}>
                Tomorrow
              </button>
              <button type="button" disabled={busy} onClick={() => answerClarify(today, "13:00")} className={chipCls}>
                This afternoon
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Time</Label>
                <Input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} />
              </div>
              <Button
                size="sm"
                className="col-span-2"
                disabled={busy || !customDate}
                onClick={() => answerClarify(customDate, customTime)}
              >
                <CalendarClock className="w-3.5 h-3.5 mr-1.5" /> Remind me then
              </Button>
            </div>
          </div>
        )}

        {step === "plan" && plan && plan.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              I found {plan.length} follow-ups in that request:
            </p>
            <ul className="rounded-lg border border-border divide-y divide-border">
              {plan.map((t, i) => (
                <li key={i} className="px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">
                    <span className="text-muted-foreground mr-1.5">{i + 1}.</span>
                    {t.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.task_type}
                    {t.draft_recipient ? ` · ${t.draft_recipient}` : ""}
                    {t.due_date ? ` · due ${t.due_date}${t.due_time ? ` ${t.due_time}` : ""}` : t.reminder_note ? ` · ${t.reminder_note}` : ""}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Each becomes its own follow-up on this {source.type} — separate types, dates, and status.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setPlan(null); setStep("choose"); }} disabled={busy}>
                Edit
              </Button>
              <Button size="sm" onClick={createPlan} disabled={busy || !plan.length}>
                {busy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  `Create ${plan.length} follow-ups`
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "confirm" && result && (result.task || (result.tasks && result.tasks.length > 1)) && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm">
              {result.updated_existing ? (
                <>
                  <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="text-muted-foreground">Updated your existing follow-up — no duplicate was created.</p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <p className="text-muted-foreground">
                    {result.tasks && result.tasks.length > 1
                      ? `${result.tasks.length} follow-ups created.`
                      : "Follow-up created."}
                  </p>
                </>
              )}
            </div>
            {result.tasks && result.tasks.length > 1 ? (
              <div className="rounded-lg border border-border divide-y divide-border">
                {result.tasks.map((t) => (
                  <div key={t.id} className="px-3 py-2.5 bg-secondary/40">
                    <p className="text-sm font-medium text-foreground">{t.title}</p>
                    <p className={cn("text-xs mt-0.5", t.due_date && t.due_date < today ? "text-red-600" : "text-muted-foreground")}>
                      {taskWhenLabel(t, today)}
                      {t.source_label ? ` · ${t.source_label}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              result.task && (
                <div className="rounded-lg border border-border bg-secondary/40 p-3">
                  <p className="text-sm font-medium text-foreground">{result.task.title}</p>
                  <p className={cn("text-xs mt-1", result.task.due_date && result.task.due_date < today ? "text-red-600" : "text-muted-foreground")}>
                    {taskWhenLabel(result.task, today)}
                    {result.task.source_label ? ` · ${result.task.source_label}` : ""}
                  </p>
                  {result.task.draft_email && !result.task.email_recorded_sent && (
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> A draft email is attached — saved in Relay only, nothing sent.
                    </p>
                  )}
                  {result.task.email_recorded_sent && (
                    <p className="text-xs text-emerald-700 mt-1.5 flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Email recorded as sent in Relay — no external email was sent.
                    </p>
                  )}
                </div>
              )
            )}
            <div className="flex justify-end gap-2 flex-wrap">
              {!result.updated_existing && (
                <Button variant="outline" size="sm" onClick={addAnother} disabled={busy}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Add another follow-up
                </Button>
              )}
              {result.task && result.task.draft_email && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDraftTask(result.task);
                    setDraftOpen(true);
                  }}
                >
                  <Mail className="w-3.5 h-3.5 mr-1.5" /> View draft
                </Button>
              )}
              <Button size="sm" onClick={viewFollowUp}>
                {result.tasks && result.tasks.length > 1 ? "View Follow-ups" : "View Follow-up"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {draftTask && (
        <TaskDraftDialog
          open={draftOpen}
          onOpenChange={setDraftOpen}
          task={draftTask}
          mode={emailNow ? "now" : "draft"}
          onSaved={(updated) => {
            setDraftTask(updated);
            setResult((r) => (r && r.task && r.task.id === updated.id ? { ...r, task: updated } : r));
          }}
          onRecorded={(updated) => {
            setDraftTask(updated);
            setResult({ created_new: true, updated_existing: false, task: updated });
            setDraftOpen(false);
          }}
        />
      )}
    </Dialog>
  );
}