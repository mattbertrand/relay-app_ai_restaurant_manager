import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import FollowUpPrompt from "@/components/FollowUpPrompt";
import { Plus } from "lucide-react";
import { taskWhenLabel, isOverdue } from "@/lib/taskSource";
import { cn } from "@/lib/utils";

// All follow-ups tied to ONE source item — a review, email, or opportunity
// can carry several separate actions (email the assistant manager, discuss at
// the meeting, call the customer), each with its own type, date, and status.
// Completing one never completes the others; the source's own status is
// untouched. The manager adds another follow-up without leaving the item.
export default function FollowUpsOnSource({ sourceType, sourceId, sourceLabel, sourceSummary, isDemo }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState(null);
  const [promptOpen, setPromptOpen] = useState(false);

  const load = useCallback(async () => {
    if (!sourceId) return;
    try {
      const page = await base44.entities.Task.filter(
        { source_id: sourceId, source_type: sourceType },
        { sort: "due_date", limit: 50 }
      );
      setTasks(page.items || []);
    } catch (e) {
      setTasks([]);
    }
  }, [sourceType, sourceId]);

  useEffect(() => { load(); }, [load]);

  if (!sourceId) return null;

  const open = (tasks || []).filter((t) => t.status !== "Completed");
  const completed = (tasks || []).filter((t) => t.status === "Completed");

  if (tasks !== null && tasks.length === 0 && !promptOpen) return null;

  const row = (t) => {
    const overdue = isOverdue(t);
    return (
      <button
        key={t.id}
        onClick={() => navigate("/tasks", { state: { focusTaskId: t.id } })}
        className="w-full flex items-center gap-2.5 px-1 py-2 text-left hover:bg-muted/40 rounded-md transition-colors"
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            t.status === "Completed" ? "bg-emerald-500" : overdue ? "bg-red-500" : "bg-amber-400"
          )}
        />
        <span
          className={cn(
            "text-sm min-w-0 flex-1 truncate",
            t.status === "Completed" && "text-muted-foreground line-through"
          )}
        >
          {t.title}
        </span>
        <span
          className={cn(
            "text-xs whitespace-nowrap shrink-0",
            t.status === "Completed" ? "text-muted-foreground" : overdue ? "text-red-600" : "text-muted-foreground"
          )}
        >
          {t.status === "Completed" ? "Completed" : taskWhenLabel(t)}
        </span>
      </button>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-sm font-semibold text-foreground">
          Follow-ups
          {tasks && tasks.length > 0 && (
            <span className="text-muted-foreground font-normal"> ({tasks.length})</span>
          )}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setPromptOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add follow-up
        </Button>
      </div>
      {tasks === null ? (
        <p className="text-xs text-muted-foreground py-2">Loading…</p>
      ) : (
        <div className="divide-y divide-border/60">
          {open.map(row)}
          {completed.map(row)}
        </div>
      )}

      <FollowUpPrompt
        open={promptOpen}
        onOpenChange={(o) => {
          setPromptOpen(o);
          if (!o) load();
        }}
        source={{
          type: sourceType,
          id: sourceId,
          label: sourceLabel || "",
          summary: sourceSummary || "",
          isDemo: !!isDemo,
        }}
        headline="New follow-up."
        question="What do you want to do next about this?"
      />
    </div>
  );
}