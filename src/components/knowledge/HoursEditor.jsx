import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { WEEKDAYS } from "@/lib/knowledge";
import TimePicker from "./TimePicker";
import { todayInTimezone } from "@/lib/format";
import { cn } from "@/lib/utils";

// Weekly operating hours plus temporary/special hours with optional dates,
// so outdated entries can be recognized and ignored.
export default function HoursEditor({ value, onChange }) {
  const hours = value.hours || {};
  const temp = value.temporary_hours || [];
  const [tempSort, setTempSort] = useState("upcoming");

  const setDay = (day, patch) =>
    onChange({ ...value, hours: { ...hours, [day]: { ...(hours[day] || {}), ...patch } } });

  const setTemp = (i, patch) =>
    onChange({ ...value, temporary_hours: temp.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });

  // Temporary/special hours are shown in chronological order (soonest
  // upcoming first); past entries are clearly badged and grouped after
  // upcoming ones. Display ordering only — stored order is untouched.
  const todayStr = todayInTimezone();
  const isPast = (t) => {
    const end = t.end_date || t.start_date || "";
    return !!end && end < todayStr;
  };
  const entries = temp.map((t, idx) => ({ t, idx }));
  let ordered;
  if (tempSort === "oldest") {
    ordered = entries.slice().sort((a, b) =>
      String(a.t.start_date || "9999-99-99").localeCompare(String(b.t.start_date || "9999-99-99"))
    );
  } else {
    const upcoming = entries
      .filter((e) => !isPast(e.t))
      .sort((a, b) =>
        String(a.t.start_date || "9999-99-99").localeCompare(String(b.t.start_date || "9999-99-99"))
      );
    const past = entries
      .filter((e) => isPast(e.t))
      .sort((a, b) =>
        String(b.t.end_date || b.t.start_date || "").localeCompare(String(a.t.end_date || a.t.start_date || ""))
      );
    ordered = upcoming.concat(past);
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        {WEEKDAYS.map((day) => {
          const h = hours[day] || {};
          return (
            <div
              key={day}
              className="grid grid-cols-1 sm:grid-cols-[7rem_1fr_1fr_auto] items-center gap-3"
            >
              <Label className="text-sm text-foreground">{day}</Label>
              <div className="space-y-1">
                <TimePicker
                  value={h.open || ""}
                  disabled={!!h.closed}
                  onChange={(v) => setDay(day, { open: v })}
                />
                <p className="text-[10px] text-muted-foreground">Opens</p>
              </div>
              <div className="space-y-1">
                <TimePicker
                  value={h.close || ""}
                  disabled={!!h.closed}
                  onChange={(v) => setDay(day, { close: v })}
                />
                <p className="text-[10px] text-muted-foreground">Closes</p>
              </div>
              <div className="flex items-center gap-2 justify-self-end sm:col-span-1">
                <span className="text-xs text-muted-foreground">Closed</span>
                <Switch checked={!!h.closed} onCheckedChange={(v) => setDay(day, { closed: v })} />
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold text-foreground">Temporary &amp; special hours</h3>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Sort:</span>
            {[
              { id: "upcoming", label: "Upcoming first" },
              { id: "oldest", label: "Oldest first" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTempSort(opt.id)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                  tempSort === opt.id
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Holiday closures, holiday hours, temporary closures, and special event hours. Add start
          and end dates so outdated entries are ignored automatically.
        </p>
        <div className="space-y-2">
          {ordered.map(({ t, idx }) => {
            const past = isPast(t);
            return (
              <div key={idx} className={cn("rounded-lg border border-border p-3 space-y-2", past && "bg-muted/40")}>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Label</Label>
                      {past && (
                        <span className="text-[10px] font-medium text-stone-500 bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5">
                          Past
                        </span>
                      )}
                    </div>
                    <Input
                      value={t.label || ""}
                      placeholder="e.g. Thanksgiving closure"
                      onChange={(e) => setTemp(idx, { label: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Starts</Label>
                      <Input type="date" value={t.start_date || ""} onChange={(e) => setTemp(idx, { start_date: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Ends</Label>
                      <Input type="date" value={t.end_date || ""} onChange={(e) => setTemp(idx, { end_date: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Details (optional)</Label>
                    <Input
                      value={t.note || ""}
                      placeholder="e.g. Closed all day / Open 11 AM–4 PM"
                      onChange={(e) => setTemp(idx, { note: e.target.value })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => onChange({ ...value, temporary_hours: temp.filter((_, i) => i !== idx) })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => onChange({ ...value, temporary_hours: [...temp, { label: "", start_date: "", end_date: "", note: "" }] })}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add special hours
        </Button>
      </div>
    </div>
  );
}