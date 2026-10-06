import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

// In-app notifications for follow-up tasks (reminders and overdue notices).
// Clicking one marks it read and opens the task. Extensible: email and push
// delivery can hang off the same notification records later.
export default function NotificationBell({ className }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const page = await base44.entities.Notification.filter(
        { read_at: null },
        { sort: "-created_date", limit: 20 }
      );
      setItems(page.items || []);
    } catch (e) {
      /* notifications are best-effort */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live updates: a reminder firing anywhere refreshes the bell.
  useEffect(() => {
    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(load, 400);
    };
    const unsub = base44.entities.Notification.subscribe(schedule);
    return () => unsub();
  }, [load]);

  const openNotification = async (n) => {
    try {
      await base44.entities.Notification.update(n.id, { read_at: new Date().toISOString() });
    } catch (e) { /* best-effort */ }
    setItems((cur) => cur.filter((x) => x.id !== n.id));
    setOpen(false);
    if (n.task_id) navigate("/tasks", { state: { focusTaskId: n.task_id } });
    else navigate("/tasks");
  };

  const markAllRead = async () => {
    try {
      const now = new Date().toISOString();
      const ids = items.map((n) => n.id);
      if (ids.length) {
        await base44.entities.Notification.bulkUpdate(ids.map((id) => ({ id, read_at: now })));
      }
      setItems([]);
    } catch (e) {
      toast({ title: "Couldn't mark notifications read", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-8 h-8 rounded-full bg-muted hover:bg-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 max-w-[calc(100vw-2rem)] bg-card rounded-xl border border-border shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {items.length > 0 && (
                <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground">
                  Mark all read
                </button>
              )}
            </div>
            {!loaded ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">No notifications right now.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openNotification(n)}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                  >
                    {n.type === "task_overdue" ? (
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    ) : n.type === "task_reminder" ? (
                      <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{n.body}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.created_date)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}