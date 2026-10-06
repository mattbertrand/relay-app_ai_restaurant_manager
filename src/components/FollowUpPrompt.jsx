import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { X, Loader2, CheckCircle2, Clock, CalendarClock } from "lucide-react";
import { taskWhenLabel } from "@/lib/taskSource";
import TaskDraftEditor from "@/components/TaskDraftEditor";
import { todayInTimezone } from "@/lib/format";
import { cn } from "@/lib/utils";

// The lightweight follow-up prompt Relay shows after a MEANINGFUL manager
// action — publishing a review response, recording an email reply, moving an
// opportunity to In Progress. One natural-language line, quick chips, and an
// easy Skip. Shown once per action; Relay never re-asks about the same
// action, and an instruction that repeats or adjusts an existing follow-up
// updates that task instead of creating a duplicate.
export default function FollowUpPrompt({ open, onOpenChange, source, headline, question }) {
  const { toast } = useToast();
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [clarify, setClarify] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setInstruction("");
      setResult(null);
      setClarify(null);
      setCustomOpen(false);
      setCustomDate("");
      setCustomTime("");
      setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
    }
  }, [open]);

  const submit = async (text) => {
    const q = String(text == null ? instruction : text).trim();
    if (!q || busy) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("createFollowUp", {
        source_type: source.type,
        source_id: source.id,
        source_label: source.label,
        source_summary: source.summary,
        source_is_demo: !!source.isDemo,
        instruction: q,
      });
      const d = res.data || {};
      if (d.no_task) {
        onOpenChange(false);
        return;
      }
      if (d.needs_clarification) {
        setClarify({ task: d.task, question: d.clarification_question || "When should I remind you?" });
      } else {
        setResult(d);
      }
      setInstruction("");
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't create the follow-up", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
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
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't set the reminder", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const today = todayInTimezone();
  const tomorrowDate = (() => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const updateTaskDraft = async (patch) => {
    if (!result || !result.task) return;
    try {
      await base44.entities.Task.update(result.task.id, patch);
      setResult({ ...result, task: { ...result.task, ...patch } });
    } catch (err) {
      toast({ title: "Couldn't save the draft", description: "Please try again.", variant: "destructive" });
    }
  };

  const quickChips = [
    { label: "Today", instruction: "Follow up on this today." },
    { label: "Tomorrow", instruction: "Follow up on this tomorrow." },
    { label: "This afternoon", instruction: "Follow up on this this afternoon." },
  ];
  const clarifyChips = [
    { label: "Today", date: today, time: "" },
    { label: "Tomorrow", date: tomorrowDate, time: "" },
    { label: "This afternoon", date: today, time: "13:00" },
  ];

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
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{headline}</p>
            <p className="text-sm text-muted-foreground mt-1">{question || "Anything else you want to do about this?"}</p>
          </div>

          {!result && !clarify && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <Input
                  ref={inputRef}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="e.g. Bring this up at the stand-up today."
                  disabled={busy}
                />
              </form>
              <div className="flex flex-wrap gap-2">
                {quickChips.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    disabled={busy}
                    onClick={() => submit(c.instruction)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
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
            </>
          )}

          {clarify && !result && (
            <div className="space-y-3">
              <p className="text-sm text-foreground">{clarify.question}</p>
              <p className="text-xs text-muted-foreground">
                Relay can't detect when someone arrives or when something is finished — pick a time and it will
                remind you then. Your trigger is saved with the task: “{clarify.task.reminder_note}”.
              </p>
              <div className="flex flex-wrap gap-2">
                {clarifyChips.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    disabled={busy}
                    onClick={() => answerClarify(c.date, c.time)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {c.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomOpen(true)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
                >
                  Choose date & time
                </button>
              </div>
              {customOpen && (
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
              )}
            </div>
          )}

          {result && result.task && (
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
                    <p className="text-muted-foreground">Follow-up created.</p>
                  </>
                )}
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-sm font-medium text-foreground">{result.task.title}</p>
                <p className={cn("text-xs mt-1", result.task.due_date && result.task.due_date < today ? "text-red-600" : "text-muted-foreground")}>
                  {taskWhenLabel(result.task, today)}
                  {result.task.source_label ? ` · ${result.task.source_label}` : ""}
                </p>
              </div>
              {result.task.draft_email ? (
                <TaskDraftEditor task={result.task} onUpdate={updateTaskDraft} />
              ) : null}
              <div className="flex justify-end">
                <Button size="sm" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}