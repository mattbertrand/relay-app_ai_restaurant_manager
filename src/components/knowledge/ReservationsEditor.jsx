import React from "react";
import { SwitchField, TextField, TextAreaField } from "./Fields";

// Reservation rules — used when analyzing reservation requests, large-party
// questions, cancellations, and reservation problems.
export default function ReservationsEditor({ value, onChange }) {
  const r = value.reservations || {};
  const set = (patch) => onChange({ ...value, reservations: { ...r, ...patch } });

  return (
    <div className="space-y-4">
      <SwitchField
        label="We accept reservations"
        checked={!!r.accepted}
        onChange={(v) => set({ accepted: v })}
      />
      <div className="grid sm:grid-cols-2 gap-4">
        <TextField
          label="Reservation method"
          value={r.method}
          onChange={(v) => set({ method: v })}
          placeholder="e.g. Phone, Resy, OpenTable, our website"
        />
        <TextField
          label="Reservation phone"
          value={r.phone}
          onChange={(v) => set({ phone: v })}
        />
        <TextField
          label="Reservation email"
          value={r.email}
          onChange={(v) => set({ email: v })}
        />
        <TextField
          label="Reservation website / channel"
          value={r.website}
          onChange={(v) => set({ website: v })}
        />
        <TextField
          label="Maximum standard party size"
          value={r.max_party_size}
          onChange={(v) => set({ max_party_size: v })}
          placeholder="e.g. 10"
        />
        <TextField
          label="Max party size without manager approval"
          value={r.max_party_without_approval}
          onChange={(v) => set({ max_party_without_approval: v })}
          placeholder="e.g. 8"
        />
      </div>
      <TextAreaField
        label="Large-party policy"
        value={r.large_party_policy}
        onChange={(v) => set({ large_party_policy: v })}
        placeholder="e.g. Parties over 10 require a set menu and a deposit. Contact events@…"
      />
      <TextAreaField
        label="Cancellation policy"
        value={r.cancellation_policy}
        onChange={(v) => set({ cancellation_policy: v })}
      />
      <TextAreaField
        label="No-show policy"
        value={r.no_show_policy}
        onChange={(v) => set({ no_show_policy: v })}
      />
      <TextAreaField
        label="Deposit policy"
        value={r.deposit_policy}
        onChange={(v) => set({ deposit_policy: v })}
      />
      <TextAreaField
        label="Reservation time restrictions"
        value={r.time_restrictions}
        onChange={(v) => set({ time_restrictions: v })}
        placeholder="e.g. Table time limits on weekends, last seating 9 PM"
      />
      <TextAreaField
        label="Other reservation rules"
        value={r.other_rules}
        onChange={(v) => set({ other_rules: v })}
      />
    </div>
  );
}