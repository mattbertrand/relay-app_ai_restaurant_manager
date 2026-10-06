import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TASK_TYPES = [
  "Follow up", "Call", "Email", "Discuss", "Investigate", "Check",
  "Meeting", "Customer follow-up", "Internal follow-up", "Other",
];

// Simple task editing — title, type, timing, priority, status, notes.
// Relay never changes these behind the manager's back; editing here updates
// the same task (never a duplicate).
export default function TaskEditDialog({ open, onOpenChange, task, onSave, loading }) {
  const [form, setForm] = useState(null);

  // Re-seed the form each time a different task is opened.
  if (open && task && (!form || form.__id !== task.id)) {
    setForm({ __id: task.id, ...task });
  }
  if (!open && form) {
    // keep the last form until reopened; harmless
  }

  if (!task || !form) return null;

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit follow-up</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input value={form.title || ""} onChange={set("title")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
                value={form.task_type || "Follow up"}
                onChange={set("task_type")}
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
                value={form.priority || "Normal"}
                onChange={set("priority")}
              >
                {["High", "Normal", "Low"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Due date</Label>
              <Input type="date" value={form.due_date || ""} onChange={set("due_date")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Due time</Label>
              <Input type="time" value={form.due_time || ""} onChange={set("due_time")} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
              value={form.status || "Open"}
              onChange={set("status")}
            >
              {["Open", "In Progress", "Completed"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Input value={form.description || ""} onChange={set("description")} placeholder="Optional notes" />
          </div>
          {form.reminder_note && (
            <p className="text-xs text-muted-foreground">
              Reminder trigger saved with this task: “{form.reminder_note}”.
            </p>
          )}
          {task.draft_email ? (
            <p className="text-xs text-muted-foreground">A draft email is attached to this task — edit it on the task card.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => onSave(form)} disabled={loading || !String(form.title || "").trim()}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}