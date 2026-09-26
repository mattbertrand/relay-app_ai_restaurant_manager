import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { WEEKDAYS } from "@/lib/knowledge";

// Weekly operating hours plus temporary/special hours with optional dates,
// so outdated entries can be recognized and ignored.
export default function HoursEditor({ value, onChange }) {
  const hours = value.hours || {};
  const temp = value.temporary_hours || [];

  const setDay = (day, patch) =>
    onChange({ ...value, hours: { ...hours, [day]: { ...(hours[day] || {}), ...patch } } });

  const setTemp = (i, patch) =>
    onChange({ ...value, temporary_hours: temp.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        {WEEKDAYS.map((day) => {
          const h = hours[day] || {};
          return (
            <div
              key={day}
              className="grid grid-cols-2 sm:grid-cols-[7rem_1fr_1fr_auto] items-center gap-3"
            >
              <Label className="text-sm text-foreground">{day}</Label>
              <div className="space-y-1">
                <Input
                  type="time"
                  value={h.open || ""}
                  disabled={!!h.closed}
                  onChange={(e) => setDay(day, { open: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">Opens</p>
              </div>
              <div className="space-y-1">
                <Input
                  type="time"
                  value={h.close || ""}
                  disabled={!!h.closed}
                  onChange={(e) => setDay(day, { close: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">Closes</p>
              </div>
              <div className="flex items-center gap-2 justify-self-end col-span-2 sm:col-span-1">
                <span className="text-xs text-muted-foreground">Closed</span>
                <Switch checked={!!h.closed} onCheckedChange={(v) => setDay(day, { closed: v })} />
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Temporary & special hours</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Holiday closures, holiday hours, temporary closures, and special event hours. Add start
          and end dates so outdated entries are ignored automatically.
        </p>
        <div className="space-y-2">
          {temp.map((t, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Label</Label>
                  <Input
                    value={t.label || ""}
                    placeholder="e.g. Thanksgiving closure"
                    onChange={(e) => setTemp(i, { label: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Starts</Label>
                    <Input type="date" value={t.start_date || ""} onChange={(e) => setTemp(i, { start_date: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Ends</Label>
                    <Input type="date" value={t.end_date || ""} onChange={(e) => setTemp(i, { end_date: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Details (optional)</Label>
                  <Input
                    value={t.note || ""}
                    placeholder="e.g. Closed all day / Open 11 AM–4 PM"
                    onChange={(e) => setTemp(i, { note: e.target.value })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={() => onChange({ ...value, temporary_hours: temp.filter((_, idx) => idx !== i) })}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
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