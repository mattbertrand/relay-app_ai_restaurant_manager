import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { timeAgo } from "@/lib/format";

// View the original email in full, plus every message in the thread — so the
// conversation stays traceable from first contact to the latest reply.
export default function ConversationOriginal({ convo }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || messages || loading) return;
    setLoading(true);
    base44.entities.ConversationMessage
      .filter({ conversation_id: convo.id }, "received_at", 20)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [open, messages, loading, convo.id]);

  const list =
    messages && messages.length
      ? messages
      : [{ id: "current", sender_name: convo.customer_name, received_at: convo.received_at, body: convo.message }];

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        View original email{list.length > 1 ? ` (${list.length} messages)` : ""}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-border bg-card p-3 max-h-72 overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
          ) : (
            list.map((m) => (
              <div key={m.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                <p className="text-xs text-muted-foreground">
                  {m.sender_name || convo.customer_name}
                  {m.received_at ? ` · ${timeAgo(m.received_at)}` : ""}
                </p>
                <p className="text-sm text-foreground whitespace-pre-line mt-1">{m.body}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}