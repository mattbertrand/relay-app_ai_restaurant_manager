import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CalendarClock, CalendarDays, Loader2, Unlink, Check } from "lucide-react";

// Relay Calendar — the Base44-managed Google Calendar connection each manager
// signs in with their own Google account. Provider-agnostic: Outlook and
// other systems are listed as coming soon and never pretend to connect.
const GOOGLE_CALENDAR_CONNECTOR_ID = "6ac29c6ed9e0034a9ab7d5cb";
const PROVIDERS = [
  { id: "google_calendar", label: "Google Calendar", hint: "Connect your Google account", available: true },
  { id: "microsoft_365", label: "Microsoft Outlook / 365", hint: "Coming soon", available: false },
  { id: "other", label: "Other calendar systems", hint: "Coming soon", available: false },
];

// Schedule: what's on the calendar today and how the week looks. Relay reads
// the schedule — it never creates events or sends invitations.
export default function ScheduleSection({ schedule, onScheduleChanged }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = async (provider) => {
    if (!provider.available) return;
    setError(null);
    setConnecting(true);
    try {
      const url = await base44.connectors.connectAppUser(GOOGLE_CALENDAR_CONNECTOR_ID);
      const popup = window.open(url, "_blank");
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setConnecting(false);
          setDialogOpen(false);
          if (onScheduleChanged) onScheduleChanged();
        }
      }, 500);
    } catch (err) {
      setConnecting(false);
      setError("Couldn't start the calendar connection. Please try again.");
    }
  };

  const handleDisconnect = async () => {
    try {
      await base44.connectors.disconnectAppUser(GOOGLE_CALENDAR_CONNECTOR_ID);
    } finally {
      if (onScheduleChanged) onScheduleChanged();
    }
  };

  if (!schedule || !schedule.connected) {
    return (
      <section id="schedule" className="mb-8">
        <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Schedule</h2>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CalendarClock className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">No calendar connected yet</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Connect your calendar to let Relay see your availability and help respond to meeting requests.
              </p>
              <Button size="sm" className="mt-3" onClick={() => setDialogOpen(true)}>
                <CalendarDays className="w-3.5 h-3.5" /> Connect Calendar
              </Button>
              {error && <p className="text-xs text-destructive mt-2">{error}</p>}
            </div>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect your calendar</DialogTitle>
              <DialogDescription>
                Relay only reads your schedule to show it here and help draft replies to meeting requests. It never
                creates events or sends invitations.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleConnect(p)}
                  disabled={!p.available || connecting}
                  className={`w-full text-left rounded-lg border p-3 flex items-center justify-between gap-3 transition-colors ${
                    p.available
                      ? "border-border hover:border-primary/40 hover:bg-muted/50"
                      : "border-border opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.hint}</p>
                  </div>
                  {p.available ? (
                    connecting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
                    ) : (
                      <span className="text-xs text-primary flex-shrink-0">Connect</span>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground flex-shrink-0">Coming soon</span>
                  )}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  const week = schedule.week || [];
  return (
    <section id="schedule" className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Schedule <span className="text-muted-foreground font-normal">({schedule.today.length})</span>
        </h2>
        <button
          onClick={handleDisconnect}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Unlink className="w-3.5 h-3.5" /> Disconnect
        </button>
      </div>
      <div className="bg-card rounded-xl border border-border p-4 md:p-5">
        <p className="text-[11px] font-semibold tracking-wide text-primary mb-2">TODAY</p>
        {schedule.today.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing on your calendar today.</p>
        ) : (
          <ul className="space-y-1.5">
            {schedule.today.map((e, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                <span className="text-xs text-muted-foreground w-24 md:w-28 flex-shrink-0">{e.time}</span>
                <span className="min-w-0">{e.title}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground mb-2 mt-4">THIS WEEK</p>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((d) => (
            <div key={d.date} className="text-center rounded-lg border border-border py-2">
              <p className="text-[10px] text-muted-foreground">{d.day}</p>
              <p className={`text-sm font-semibold ${d.count ? "text-foreground" : "text-muted-foreground/50"}`}>
                {d.count}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          From {schedule.provider_label || schedule.provider} · Relay reads your schedule; it never creates events or
          sends invitations.
        </p>
      </div>
    </section>
  );
}