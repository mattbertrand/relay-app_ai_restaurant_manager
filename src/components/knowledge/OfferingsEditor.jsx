import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { SwitchField, TextField } from "./Fields";

// Happy hour and recurring offerings — brunch, live music, taco night, wine
// night, trivia, seasonal events.
export default function OfferingsEditor({ value, onChange }) {
  const h = value.happy_hour || {};
  const offerings = value.recurring_offerings || [];
  const setHappy = (patch) => onChange({ ...value, happy_hour: { ...h, ...patch } });
  const setOffering = (i, patch) =>
    onChange({ ...value, recurring_offerings: offerings.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });

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
              <Input type="time" value={h.start_time || ""} onChange={(e) => setHappy({ start_time: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ends</Label>
              <Input type="time" value={h.end_time || ""} onChange={(e) => setHappy({ end_time: e.target.value })} />
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
        </p>
        <div className="space-y-2">
          {offerings.map((o, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    value={o.name || ""}
                    placeholder="e.g. Weekend brunch"
                    onChange={(e) => setOffering(i, { name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Days</Label>
                    <Input
                      value={o.days || ""}
                      placeholder="e.g. Sat–Sun"
                      onChange={(e) => setOffering(i, { days: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Time</Label>
                    <Input
                      value={o.time || ""}
                      placeholder="e.g. 10 AM–2 PM"
                      onChange={(e) => setOffering(i, { time: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Details (optional)</Label>
                  <Input
                    value={o.details || ""}
                    onChange={(e) => setOffering(i, { details: e.target.value })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={() => onChange({ ...value, recurring_offerings: offerings.filter((_, idx) => idx !== i) })}
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
          onClick={() => onChange({ ...value, recurring_offerings: [...offerings, { name: "", days: "", time: "", details: "" }] })}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add recurring offering
        </Button>
      </div>
    </div>
  );
}