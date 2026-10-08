import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getRestaurantId, todayInTimezone, formatTime12 } from "@/lib/format";
import BackToToday from "@/components/BackToToday";
import TaskCard from "@/components/TaskCard";
import TaskEditDialog from "@/components/TaskEditDialog";
import TaskDraftDialog from "@/components/TaskDraftDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Search, RefreshCw, ClipboardList, Loader2 } from "lucide-react";
import {
  taskActivity,
  isOverdue,
  isSnoozed,
  navigateToSource,
  taskWhenLabel,
} from "@/lib/taskSource";
import { activityLabel, isUserFacingActivity } from "@/lib/activityLabels";
import { cn } from "@/lib/utils";

// The manager's follow-up center — Today, Upcoming, Overdue, Completed.
// Deliberately simple: tasks the manager explicitly committed to, each tied
// to the Relay item it came from. Not a project-management tool.
export default function Tasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [tasks, setTasks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftTask, setDraftTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const focusTaskId = (location.state && location.state.focusTaskId) || null;

  const load = useCallback(async () => {
    const rid = getRestaurantId(user);
    if (!rid) { setLoading(false); return; }
    setRefreshing(true);
    try {
      const [active, completed] = await Promise.all([
        base44.entities.Task.filter(
          { restaurant_id: rid, status: { $in: ["Open", "In Progress"] } },
          { sort: "due_date", limit: 200 }
        ),
        base44.entities.Task.filter(
          { restaurant_id: rid, status: "Completed" },
          { sort: "-completed_at", limit: 50 }
        ),
      ]);
      setTasks({ active: active.items || [], completed: completed.items || [] });
    } catch (err) {
      console.error(err);
      setTasks({ active: [], completed: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Basic keyword search — a server filter over open tasks, nothing fancier.
  useEffect(() => {
    const rid = getRestaurantId(user);
    if (!rid) return;
    if (!query.trim()) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const page = await base44.entities.Task.filter(
          {
            restaurant_id: rid,
            status: { $in: ["Open", "In Progress"] },
            title: { $regex: query.trim(), $options: "i" },
          },
          { sort: "due_date", limit: 100 }
        );
        setTasks((cur) => ({ ...(cur || { completed: [] }), active: page.items || [] }));
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, user]);

  // Clearing the search reloads the unfiltered list.
  useEffect(() => {
    if (query.trim() === "" && tasks) {
      const t = setTimeout(load, 200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const patchTask = async (task, patch, activityType, activityDescription) => {
    if (busy) return;
    setBusy(true);
    try {
      await base44.entities.Task.update(task.id, patch);
      if (activityType) {
        await taskActivity({ ...task, ...patch }, activityType, activityDescription).catch(() => {});
      }
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const completeTask = (task) => {
    patchTask(
      task,
      {
        status: "Completed",
        completed_at: new Date().toISOString(),
        completed_by: user?.id || "",
        snooze_until: "",
      },
      "task_completed",
      `Follow-up completed — "${task.title}".`
    );
  };

  const reopenTask = (task) => {
    patchTask(task, { status: "Open", completed_at: "", completion_note: "" }, "task_reopened", `Follow-up reopened — "${task.title}".`);
  };

  const snoozeTask = (task, untilIso) => {
    if (!untilIso) return;
    patchTask(
      task,
      { snooze_until: untilIso, reminder_status: "none" },
      "task_snoozed",
      `Follow-up snoozed — "${task.title}".`
    );
  };

  // Record the follow-up's email as sent IN RELAY ONLY — no external email
  // is transmitted. Distinct from completing the follow-up.
  const recordSent = async (task) => {
    if (busy) return;
    setBusy(true);
    try {
      await base44.functions.invoke("recordEmailSent", {
        task_id: task.id,
        to_name: task.draft_recipient || "",
        to_email: task.draft_recipient_email || "",
        subject: task.draft_subject || "",
        body: task.draft_email || "",
      });
      toast({
        title: "Email recorded as sent",
        description: "Recorded in Relay — no external email was sent.",
      });
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't record the email", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const saveEdits = async (form) => {
    if (!editTask || saving) return;
    setSaving(true);
    try {
      const patch = {
        title: String(form.title || "").trim(),
        task_type: form.task_type,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || "",
        due_time: form.due_time || "",
        description: form.description || "",
      };
      if (patch.status === "Completed" && editTask.status !== "Completed") {
        patch.completed_at = new Date().toISOString();
        patch.completed_by = user?.id || "";
      }
      await base44.entities.Task.update(editTask.id, patch);
      await taskActivity({ ...editTask, ...patch }, "task_updated", `Follow-up updated — "${patch.title}".`).catch(() => {});
      setEditOpen(false);
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't save your changes", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const today = todayInTimezone();

  // When the manager arrives from a reminder, a source item, or Today, the
  // follow-up they came for is scrolled into view, highlighted, and named —
  // so they always know which card to look at.
  const focusedTask = focusTaskId && tasks
    ? [...((tasks && tasks.active) || []), ...((tasks && tasks.completed) || [])]
        .find((t) => t.id === focusTaskId)
    : null;

  useEffect(() => {
    if (!focusTaskId || loading || !focusedTask) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`task-${focusTaskId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => clearTimeout(timer);
  }, [focusTaskId, loading, focusedTask]);

  // Section split over the loaded page — the whole active list is shown,
  // grouped for scanning, with overdue surfaced first.
  const active = (tasks && tasks.active) || [];
  const visible = active.filter((t) => !isSnoozed(t));
  const snoozed = active.filter((t) => isSnoozed(t));
  const overdue = visible.filter((t) => isOverdue(t, today));
  const todayTasks = visible.filter((t) => t.due_date === today);
  const rest = visible.filter((t) => t.due_date !== today && !isOverdue(t, today)); // includes no-date
  const byDueTime = (a, b) => String(a.due_time || "99:99").localeCompare(String(b.due_time || "99:99"));
  todayTasks.sort(byDueTime);
  rest.sort((a, b) => {
    if (!a.due_date && b.due_date) return 1;
    if (a.due_date && !b.due_date) return -1;
    return String(a.due_date || "").localeCompare(String(b.due_date || "")) || byDueTime(a, b);
  });
  overdue.sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

  // Within a section, follow-ups from the same source item sit together —
  // the manager sees at a glance that several actions belong to one issue.
  // Everything else keeps its due-date order.
  const groupBySource = (list) => {
    const counts = {};
    list.forEach((t) => {
      const k = t.source_id || "";
      if (k) counts[k] = (counts[k] || 0) + 1;
    });
    const withIndex = list.map((t, i) => ({ t, i }));
    withIndex.sort((a, b) => {
      const ka = counts[a.t.source_id || ""] >= 2 ? a.t.source_id : "";
      const kb = counts[b.t.source_id || ""] >= 2 ? b.t.source_id : "";
      if (ka !== kb) {
        if (ka && !kb) return -1;
        if (!ka && kb) return 1;
        return ka < kb ? -1 : 1;
      }
      return a.i - b.i;
    });
    return withIndex.map(({ t }) => t);
  };

  const renderSection = (label, list, dimmed = false) => {
    if (!list.length) return null;
    const ordered = groupBySource(list);
    return (
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-2">
          {label} <span className="text-muted-foreground font-normal">({list.length})</span>
        </h2>
        <div className={cn("space-y-2", dimmed && "opacity-75")}>
          {ordered.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              todayStr={today}
              focused={t.id === focusTaskId}
              onComplete={completeTask}
              onReopen={reopenTask}
              onSnooze={snoozeTask}
              onEdit={(task) => { setEditTask(task); setEditOpen(true); }}
              onSource={(task) => navigateToSource(navigate, task, { fromTasks: true })} onRecordSent={recordSent}
              onDraft={(task) => { setDraftTask(task); setDraftOpen(true); }}
              onUpdate={async (patch) => {
                await base44.entities.Task.update(t.id, patch);
                await load();
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto pb-20 md:pb-8">
      <BackToToday label="Tasks" />
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">Follow-ups</h1>
          <p className="text-muted-foreground text-sm mt-1">
            What you've decided to do — each tied to the review, email, or opportunity it came from.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={refreshing}>
          {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Refresh
        </Button>
      </div>

      <div className="relative mb-5">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your follow-ups…"
          className="pl-9"
        />
        {searching && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />}
      </div>

      {focusTaskId && focusedTask && (
        <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          <p className="text-sm text-foreground">
            Highlighted below: <span className="font-medium">{focusedTask.title}</span>
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
        </div>
      ) : !tasks || (!active.length && !(tasks.completed || []).length) ? (
        <div className="bg-card rounded-xl border border-border p-10 text-center">
          <div className="w-10 h-10 rounded-full bg-secondary mx-auto flex items-center justify-center mb-3">
            <ClipboardList className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No follow-ups yet. After you record a response or move something forward, Relay will ask if you want to
            follow up — and anything you create will live here.
          </p>
        </div>
      ) : (
        <>
          {overdue.length > 0 && renderSection("Overdue", overdue)}
          {todayTasks.length > 0 && renderSection("Today", todayTasks)}
          {rest.length > 0 && renderSection("Upcoming", rest)}
          {snoozed.length > 0 && renderSection("Snoozed", snoozed, true)}
          {(tasks.completed || []).length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-foreground mb-2">
                Completed <span className="text-muted-foreground font-normal">(recent)</span>
              </h2>
              <div className="space-y-2">
                {tasks.completed.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    todayStr={today}
                    onComplete={completeTask}
                    onReopen={reopenTask}
                    onSnooze={snoozeTask}
                    onEdit={(task) => { setEditTask(task); setEditOpen(true); }}
                    onSource={(task) => navigateToSource(navigate, task, { fromTasks: true })} onRecordSent={recordSent}
                    onDraft={(task) => { setDraftTask(task); setDraftOpen(true); }}
                    onUpdate={async (patch) => {
                      await base44.entities.Task.update(t.id, patch);
                      await load();
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <TaskEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        task={editTask}
        onSave={saveEdits}
        loading={saving}
      />

      <TaskDraftDialog
        open={draftOpen}
        onOpenChange={setDraftOpen}
        task={draftTask}
        onSaved={(updated) => {
          setDraftTask(updated);
          // Patch the task in place so the card reflects the saved draft.
          setTasks((cur) =>
            cur
              ? {
                  active: cur.active.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
                  completed: (cur.completed || []).map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
                }
              : cur
          );
        }}
      />
    </div>
  );
}