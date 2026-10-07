import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, CalendarClock } from "lucide-react";
import { WEEKDAYS } from "@/lib/knowledge";
import TimePicker from "./TimePicker";

// Recurring special hours — weekly rules (e.g. "Trivia Night, every Monday
// 6–10 PM") with per-date exceptions. The rule is stored once; occurrences
// are computed when needed, never materialized as individual entries.
const emptyRule = () => ({
  label: "",
  frequency: "weekly",
  day_of_week: "Monday",
  start_time: "",
  end_time: "",
  effective_start_date: "",
  end_date: "",
  exceptions: [],
});

const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function RecurringSpecialHours({ value, onChange }) {
  const rules = (value.recurring_special_hours || []).filter((r) => r && typeof r === "object");
  const [editingIdx, setEditingIdx] = useState(null);
  const [managingIdx, setManagingIdx] = useState(null);

  const setRules = (next) => onChange({ ...value, recurring_special_hours: next });
  const setRule = (i, patch) => setRules(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="text-sm font-semibold text-foreground">Recurring special hours</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setRules([...rules, emptyRule()]);
            setEditingIdx(rules.length);
            setManagingIdx(null);
          }}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add recurring hours
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Weekly events or hour changes that repeat on their own — trivia nights, open mics,
        recurring closures. One rule covers every week; skip individual dates with exceptions.
        A one-time special hours entry on the same date always takes precedence.
      </p>

      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground border border-border rounded-lg bg-muted/40 p-3">
          No recurring special hours yet. Add one if a weekly event changes your regular hours.
        </p>
      )}

      <div className="space-y-2">
        {rules.map((r, idx) => {
          const time = r.start_time || r.end_time ? `${r.start_time || "?"}–${r.end_time || "?"}` : "";
          const exceptions = (r.exceptions || []).filter((x) => x && x.date);
          const editing = editingIdx === idx;
          const managing = managingIdx === idx;
          return (
            <div key={idx} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{r.label || "Untitled rule"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {`Every ${r.day_of_week || "?"}${time ? ` · ${time}` : ""}`}
                    {r.effective_start_date ? ` · Active from ${fmtDate(r.effective_start_date)}` : ""}
                    {exceptions.length ? ` · ${exceptions.length} exception${exceptions.length === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingIdx(editing ? null : idx);
                      setManagingIdx(null);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> {editing ? "Close" : "Edit"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setManagingIdx(managing ? null : idx);
                      setEditingIdx(null);
                    }}
                  >
                    <CalendarClock className="w-3.5 h-3.5 mr-1.5" /> {managing ? "Close" : "Manage exceptions"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => {
                      setRules(rules.filter((_, i) => i !== idx));
                      setEditingIdx(null);
                      setManagingIdx(null);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {editing && (
                <div className="mt-3 pt-3 border-t border-border grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Label</Label>
                    <Input
                      value={r.label || ""}
                      placeholder="e.g. Trivia Night"
                      onChange={(e) => setRule(idx, { label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Frequency</Label>
                    <Input value="Weekly" disabled />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Day</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
                      value={r.day_of_week || "Monday"}
                      onChange={(e) => setRule(idx, { day_of_week: e.target.value })}
                    >
                      {WEEKDAYS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Starts</Label>
                      <TimePicker value={r.start_time || ""} onChange={(v) => setRule(idx, { start_time: v })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Ends</Label>
                      <TimePicker value={r.end_time || ""} onChange={(v) => setRule(idx, { end_time: v })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Active starting</Label>
                    <Input
                      type="date"
                      value={r.effective_start_date || ""}
                      onChange={(e) => setRule(idx, { effective_start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Until (optional)</Label>
                    <Input
                      type="date"
                      value={r.end_date || ""}
                      onChange={(e) => setRule(idx, { end_date: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {managing && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Skipped dates — the rule stays active and continues on later weeks. A one-time
                    special hours entry on the same date also takes precedence automatically.
                  </p>
                  {exceptions.map((x, xi) => (
                    <div key={xi} className="grid sm:grid-cols-[10rem_1fr_auto] gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Date</Label>
                        <Input
                          type="date"
                          value={x.date || ""}
                          onChange={(e) =>
                            setRule(idx, {
                              exceptions: (r.exceptions || []).map((y, yi) =>
                                yi === xi ? { ...y, date: e.target.value } : y
                              ),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
                        <Input
                          value={x.note || ""}
                          placeholder="e.g. Private event"
                          onChange={(e) =>
                            setRule(idx, {
                              exceptions: (r.exceptions || []).map((y, yi) =>
                                yi === xi ? { ...y, note: e.target.value } : y
                              ),
                            })
                          }
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                        onClick={() =>
                          setRule(idx, { exceptions: (r.exceptions || []).filter((_, yi) => yi !== xi) })
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRule(idx, { exceptions: [...(r.exceptions || []), { date: "", note: "" }] })}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Skip a date
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}