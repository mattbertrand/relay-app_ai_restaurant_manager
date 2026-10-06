import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Save, Trash2, Mail } from "lucide-react";

// A task's associated draft email. The draft is saved inside Relay only —
// Relay never sends email automatically. The manager can edit or delete the
// draft; sending happens only if/when a real email integration is used.
export default function TaskDraftEditor({ task, onUpdate, compact = false }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(task.draft_email || "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onUpdate({ draft_email: text, draft_edited: true });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await onUpdate({ draft_email: "", draft_subject: "", draft_edited: false });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? "space-y-2" : "rounded-lg border border-border bg-card p-3 space-y-2"}>
      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Draft email — saved in Relay only. No email has been sent.
      </p>
      {task.draft_subject && !editing && (
        <p className="text-xs font-medium text-foreground">Subject: {task.draft_subject}</p>
      )}
      {editing ? (
        <>
          <textarea
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm min-h-[120px] resize-y"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={busy}>
              <Save className="w-3.5 h-3.5 mr-1.5" /> Save draft
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setEditing(false); setText(task.draft_email || ""); }} disabled={busy}>
              Cancel
            </Button>
          </div>
        </>
      ) : task.draft_email ? (
        <>
          <div className="text-sm text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto rounded-md bg-secondary/40 p-3">
            {task.draft_email}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setText(task.draft_email || ""); setEditing(true); }} disabled={busy}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit draft
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={remove} disabled={busy}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete draft
            </Button>
          </div>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={busy}>
          <Pencil className="w-3.5 h-3.5 mr-1.5" /> Write draft
        </Button>
      )}
    </div>
  );
}