import React, { useEffect, useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// A conventional 12-hour US time picker: hour + minute + AM/PM, no long
// scrolling lists. Stores the same "HH:mm" 24-hour value as before, so
// existing saved times keep working and nothing changes in storage.
//
// Layout contract: every part has its own fixed, generous width and its own
// reserved chevron space (the native select arrow is hidden and replaced by
// an icon inside that reserved space), so the selected value is always fully
// readable — hour 1–12, minutes, and AM/PM never clip or get overlapped, no
// matter how narrow the surrounding column is. Parts wrap rather than overlap.
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

// appearance-none hides the OS chevron; a custom icon sits inside the
// reserved right padding, so it can never cover the value.
const selectClass =
  "h-9 shrink-0 appearance-none rounded-md border border-input bg-card pl-3 pr-8 text-sm text-foreground leading-none focus:outline-none focus:ring-1 focus:ring-ring";

function TimeSelect({ label, value, options, emptyLabel, onChange, className }) {
  return (
    <span className={cn("relative inline-block shrink-0", className)}>
      <select
        aria-label={label}
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
    </span>
  );
}

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
    <div className={cn("flex flex-wrap items-center gap-1 min-w-0", disabled && "pointer-events-none opacity-50", className)}>
      <TimeSelect
        label="Hour"
        value={sel.hour}
        options={HOURS}
        emptyLabel="HH"
        onChange={(v) => update({ hour: v })}
        className="w-[4.25rem]"
      />
      <span className="text-muted-foreground text-sm shrink-0">:</span>
      <TimeSelect
        label="Minute"
        value={sel.minute}
        options={MINUTES}
        emptyLabel="MM"
        onChange={(v) => update({ minute: v })}
        className="w-[4.25rem]"
      />
      <TimeSelect
        label="AM or PM"
        value={sel.period}
        options={["AM", "PM"]}
        emptyLabel="--"
        onChange={(v) => update({ period: v })}
        className="w-[4.75rem]"
      />
      {hasValue && !disabled && (
        <button
          type="button"
          onClick={clear}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Clear time"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}