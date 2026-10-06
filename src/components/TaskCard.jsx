import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckCircle2, Clock, Pencil, RotateCcw, ChevronRight, Mail } from "lucide-react";
import { taskWhenLabel, isOverdue, isSnoozed, navigateToSource, snoozeOptions, zonedToUtcIso } from "@/lib/taskSource";
import { cn } from "@/lib/utils";

const PRIORITY_DOT = {
  High: "bg-red-500",
  Normal: "bg-amber-400",
  Low: "bg-stone-300",
};

const TYPE_LABELS = {
  "Follow up": "Follow-up",
  Call: "Call",
  Email: "Email",
  Discuss: "Discuss",
  Investigate: "Investigate",
  Check: "Check",
  Meeting: "Meeting",
  "Customer follow-up": "Customer follow-up",
  "Internal follow-up": "Internal follow-up",
  Other: "Other",
};

// One follow-up task: what to do, when, why it's here (the source), and the
// quick actions — complete, snooze, edit, open the source.
export default function TaskCard({
  task,
  todayStr,
  onComplete,
  onReopen,
  onSnooze,
  onEdit,
  onSource,
  onUpdate,
  onDraft,
  focused = false,
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const overdue = isOverdue(task, todayStr);
  const snoozed = isSnoozed(task);
  const hasSource = !!task.source_id && ["review", "email", "opportunity"].includes(task.source_type);

  return (
    <div
      id={`task-${task.id}`}
      className={cn(
        "rounded-xl border bg-card p-4 transition-shadow",
        focused ? "border-primary/50 shadow-sm" : "border-border",
        overdue && !snoozed && "border-red-200 bg-red-50/40",
        task.status === "Completed" && "opacity-70"
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", PRIORITY_DOT[task.priority] || "bg-stone-300")} />
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium text-foreground", task.status === "Completed" && "line-through")}>
            {task.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-muted-foreground">
            <span className={cn(overdue && !snoozed && "text-red-600 font-medium")}>{taskWhenLabel(task, todayStr)}</span>
            {task.task_type && <span>· {TYPE_LABELS[task.task_type] || task.task_type}</span>}
            {task.source_label && <span>· {task.source_label}</span>}
            {snoozed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 border border-stone-200 text-stone-500">
                <Clock className="w-3 h-3" /> Snoozed until {new Date(task.snooze_until).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            )}
            {task.status === "In Progress" && <span>· In Progress</span>}
          </div>
          {task.completion_note && task.status === "Completed" && (
            <p className="text-xs text-muted-foreground mt-1">Note: {task.completion_note}</p>
          )}
          {task.description && task.status !== "Completed" && (
            <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
          )}
          {task.status !== "Completed" && (task.task_type === "Email" || task.draft_email) && (
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => onDraft && onDraft(task)}>
                <Mail className="w-3.5 h-3.5 mr-1.5" />
                {task.draft_email ? "View draft" : "Write Email"}
              </Button>
              {task.draft_email && (
                <p className="text-xs text-muted-foreground mt-1">Draft saved in Relay — no email has been sent.</p>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {task.status === "Completed" ? (
            <Button variant="ghost" size="sm" onClick={() => onReopen(task)} title="Reopen">
              <RotateCcw className="w-4 h-4" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onComplete(task)} title="Mark complete">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" title="Snooze">
                    <Clock className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {snoozeOptions().map((o) => (
                    <DropdownMenuItem key={o.id} onClick={() => onSnooze(task, o.until)}>
                      {o.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onClick={() => setCustomOpen(true)}>Choose date & time</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="sm" onClick={() => onEdit(task)} title="Edit">
                <Pencil className="w-4 h-4" />
              </Button>
            </>
          )}
          {hasSource && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSource(task)}
              title="Open the source"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {customOpen && (
        <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Snooze until</label>
            <Input2 type="date" value={customDate} onChange={setCustomDate} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Time</label>
            <Input2 type="time" value={customTime} onChange={setCustomTime} />
          </div>
          <Button
            size="sm"
            className="col-span-2"
            disabled={!customDate}
            onClick={() => {
              setCustomOpen(false);
              onSnooze(task, zonedToUtcIso(customDate, customTime, null));
            }}
          >
            Snooze
          </Button>
        </div>
      )}
    </div>
  );
}

// Minimal date/time inputs (kept tiny here — used only inside the snooze row).
function Input2({ type, value, onChange }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm"
    />
  );
}