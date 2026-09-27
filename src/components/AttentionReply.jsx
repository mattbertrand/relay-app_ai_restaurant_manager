import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit3, Save, CheckCircle2 } from "lucide-react";
import { setUnsavedChanges, clearUnsavedChanges } from "@/lib/unsavedChanges";

// Suggested reply for a live Attention message. "Record Reply" records the
// response in Relay — no email is actually sent to the customer.
export default function AttentionReply({ convo, onSaveDraft, onMarkReplied, busy }) {
  const replied = convo.reply_status === "Reply recorded";
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  const startEditing = () => {
    setText(convo.draft_response || "");
    setEditing(true);
  };

  const handleSave = async () => {
    await onSaveDraft(convo, text);
    setEditing(false);
  };

  // Block navigation away while the editor has unsaved edits — the shared
  // guard offers to save them first.
  useEffect(() => {
    if (!editing || text === (convo.draft_response || "")) return;
    setUnsavedChanges({
      isDirty: () => text !== (convo.draft_response || ""),
      save: handleSave,
    });
    return () => clearUnsavedChanges();
  });

  return (
    <div className="mt-3 rounded-lg bg-muted/60 border border-border p-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          {replied ? "Recorded reply" : "Suggested reply"}
        </p>
        {replied && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            Reply recorded
          </span>
        )}
      </div>
      {editing ? (
        <div className="space-y-2.5">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="resize-none bg-card text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={busy}>
              <Save className="w-3.5 h-3.5 mr-1.5" /> Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-foreground whitespace-pre-line">{convo.draft_response}</p>
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {!replied && (
              <Button size="sm" onClick={() => onMarkReplied(convo, convo.draft_response)} disabled={busy}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Record Reply
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={startEditing} disabled={busy}>
              <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {replied
              ? "Recorded in Relay — no email was sent to the customer."
              : "This records the response in Relay. No email will be sent to the customer."}
          </p>
        </>
      )}
    </div>
  );
}