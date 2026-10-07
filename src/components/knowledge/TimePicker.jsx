import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// A conventional 12-hour US time picker: hour + minute + AM/PM, no long
// scrolling lists. Stores the same "HH:mm" 24-hour value as before, so
// existing saved times keep working and nothing changes in storage.
//
// Layout contract: every part has its own fixed width and the clear button
// its own space — the parts wrap rather than ever overlap, no matter how
// narrow the column around them is. Chevrons sit in reserved padding, so the
// selected value is always fully readable.
const HOURS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function toParts(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!m) return { hour: "", minute: "", period: "" };
  let h = parseInt(m[1], 10);
  const period = h >= 12 && h < 24 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return { hour: String(h), minute: m[2], period };
}

const selectClass =
  "h-9 shrink-0 rounded-md border border-input bg-transparent pl-2 pr-7 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export default function TimePicker({ value, onChange, disabled, className }) {
  const [sel, setSel] = useState(() => toParts(value));

  useEffect(() => {
    setSel(toParts(value));
  }, [value]);

  const update = (patch) => {
    const next = { ...sel, ...patch };
    setSel(next);
    if (next.hour && next.minute && next.period) {
      let h = parseInt(next.hour, 10) % 12;
      if (next.period === "PM") h += 12;
      onChange(`${String(h).padStart(2, "0")}:${next.minute}`);
    } else if (!next.hour && !next.minute && !next.period) {
      onChange("");
    }
  };

  const clear = () => {
    setSel({ hour: "", minute: "", period: "" });
    onChange("");
  };

  const hasValue = sel.hour || sel.minute || sel.period;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", disabled && "pointer-events-none opacity-50", className)}>
      <select
        aria-label="Hour"
        className={cn(selectClass, "w-14")}
        value={sel.hour}
        onChange={(e) => update({ hour: e.target.value })}
      >
        <option value="">HH</option>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground text-sm shrink-0">:</span>
      <select
        aria-label="Minute"
        className={cn(selectClass, "w-14")}
        value={sel.minute}
        onChange={(e) => update({ minute: e.target.value })}
      >
        <option value="">MM</option>
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label="AM or PM"
        className={cn(selectClass, "w-16")}
        value={sel.period}
        onChange={(e) => update({ period: e.target.value })}
      >
        <option value="">--</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
      {hasValue && !disabled && (
        <button
          type="button"
          onClick={clear}
          className="shrink-0 w-7 h-7 -ml-0.5 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Clear time"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}