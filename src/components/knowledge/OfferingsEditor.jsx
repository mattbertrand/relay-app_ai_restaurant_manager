import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { SwitchField, TextField } from "./Fields";
import TimePicker from "./TimePicker";
import { WEEKDAYS } from "@/lib/knowledge";
import { normalizeTimeRangeText } from "@/lib/format";

// Happy hour and recurring offerings — brunch, live music, taco night, wine
// night, trivia, seasonal events.
export default function OfferingsEditor({ value, onChange }) {
  const h = value.happy_hour || {};
  const offerings = value.recurring_offerings || [];
  const setHappy = (patch) => onChange({ ...value, happy_hour: { ...h, ...patch } });
  const setOffering = (i, patch) =>
    onChange({ ...value, recurring_offerings: offerings.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });

  // Recurring offerings are displayed grouped by day of week (Monday first),
  // then by start time. Display ordering only — stored order is untouched.
  const DAY_INDEX = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
  const primaryDayIndex = (days) => {
    const d = String(days || "").toLowerCase();
    for (const key of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) {
      if (d.includes(key)) return DAY_INDEX[key];
    }
    return -1;
  };
  const startMinutes = (time) => {
    const m = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i.exec(String(time || ""));
    if (!m) return 9999;
    let hh = parseInt(m[1], 10);
    const period = (m[3] || "").toLowerCase();
    if (period.startsWith("p") && hh < 12) hh += 12;
    if (period.startsWith("a") && hh === 12) hh = 0;
    return hh * 60 + parseInt(m[2] || "0", 10);
  };
  const ordered = offerings
    .map((o, idx) => ({ o, idx }))
    .sort((a, b) => {
      const da = primaryDayIndex(a.o.days);
      const db = primaryDayIndex(b.o.days);
      if (da !== db) return (da === -1 ? 99 : da) - (db === -1 ? 99 : db);
      const ta = startMinutes(a.o.time);
      const tb = startMinutes(b.o.time);
      if (ta !== tb) return ta - tb;
      return a.idx - b.idx;
    });

  let lastDay = null;
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Happy hour</h3>
        <SwitchField
          label="We have a happy hour"
          checked={!!h.offered}
          onChange={(v) => setHappy({ offered: v })}
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField
            label="Days"
            value={h.days}
            onChange={(v) => setHappy({ days: v })}
            placeholder="e.g. Monday–Friday"
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Starts</Label>
              <TimePicker value={h.start_time || ""} onChange={(v) => setHappy({ start_time: v })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ends</Label>
              <TimePicker value={h.end_time || ""} onChange={(v) => setHappy({ end_time: v })} />
            </div>
          </div>
        </div>
        <TextField
          label="Happy hour details"
          value={h.details}
          onChange={(v) => setHappy({ details: v })}
          placeholder="e.g. Discounted drinks and bar snacks at the counter"
        />
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">Recurring offerings</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Brunch, live music, trivia, wine night, seasonal events — anything customers regularly ask about.
          Shown by day, earliest first.
        </p>
        <div className="space-y-2">
          {ordered.map(({ o, idx }) => {
            const dayIdx = primaryDayIndex(o.days);
            const showHeader = dayIdx !== lastDay;
            lastDay = dayIdx;
            const normalized = normalizeTimeRangeText(o.time);
            return (
              <React.Fragment key={idx}>
                {showHeader && (
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">
                    {dayIdx >= 0 ? WEEKDAYS[dayIdx] : "Other days"}
                  </h4>
                )}
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input
                        value={o.name || ""}
                        placeholder="e.g. Weekend brunch"
                        onChange={(e) => setOffering(idx, { name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Days</Label>
                        <Input
                          value={o.days || ""}
                          placeholder="e.g. Sat–Sun"
                          onChange={(e) => setOffering(idx, { days: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Time</Label>
                        <Input
                          value={o.time || ""}
                          placeholder="e.g. 10 AM–2 PM"
                          onChange={(e) => setOffering(idx, { time: e.target.value })}
                        />
                        {normalized && normalized !== (o.time || "") && (
                          <p className="text-[10px] text-muted-foreground">Displayed as {normalized}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Details (optional)</Label>
                      <Input
                        value={o.details || ""}
                        onChange={(e) => setOffering(idx, { details: e.target.value })}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground"
                      onClick={() => onChange({ ...value, recurring_offerings: offerings.filter((_, i) => i !== idx) })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => onChange({ ...value, recurring_offerings: [...offerings, { name: "", days: "", time: "", details: "" }] })}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add recurring offering
        </Button>
      </div>
    </div>
  );
}