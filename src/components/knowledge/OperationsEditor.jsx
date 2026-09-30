import React from "react";
import { TextField, TextAreaField } from "./Fields";

// Operations context — how the restaurant actually runs day to day. Relay
// uses it (conservatively) when an email touches equipment, maintenance, or
// urgent operational matters.
export default function OperationsEditor({ value, onChange }) {
  const o = value.operations || {};
  const set = (patch) => onChange({ ...value, operations: { ...o, ...patch } });

  return (
    <div className="space-y-4">
      <TextAreaField
        label="Opening procedures"
        value={o.opening_procedures}
        onChange={(v) => set({ opening_procedures: v })}
        placeholder="What needs to happen to open"
        rows={2}
      />
      <TextAreaField
        label="Closing procedures"
        value={o.closing_procedures}
        onChange={(v) => set({ closing_procedures: v })}
        placeholder="What needs to happen to close"
        rows={2}
      />
      <TextAreaField
        label="Manager responsibilities"
        value={o.manager_responsibilities}
        onChange={(v) => set({ manager_responsibilities: v })}
        placeholder="What the manager on duty handles"
        rows={2}
      />
      <TextAreaField
        label="Recurring duties"
        value={o.recurring_duties}
        onChange={(v) => set({ recurring_duties: v })}
        placeholder="e.g. Weekly inventory Tuesdays, linen pickup Thursdays"
        rows={2}
      />
      <div className="grid sm:grid-cols-2 gap-4">
        <TextField
          label="Maintenance contacts"
          value={o.maintenance_contacts}
          onChange={(v) => set({ maintenance_contacts: v })}
          placeholder="e.g. Refrigeration: Chills Services (503) 555-0142"
        />
        <TextField
          label="Equipment contacts"
          value={o.equipment_contacts}
          onChange={(v) => set({ equipment_contacts: v })}
          placeholder="Who services which equipment"
        />
        <TextField
          label="Emergency contacts"
          value={o.emergency_contacts}
          onChange={(v) => set({ emergency_contacts: v })}
          placeholder="e.g. Plumbing: Ridgeline (503) 555-0119"
        />
        <TextField
          label="Cleaning procedures"
          value={o.cleaning_procedures}
          onChange={(v) => set({ cleaning_procedures: v })}
          placeholder="Key cleaning routines"
        />
      </div>
      <TextAreaField
        label="Operational policies"
        value={o.operational_policies}
        onChange={(v) => set({ operational_policies: v })}
        placeholder="Standing policies about how the restaurant operates"
        rows={2}
      />
      <TextAreaField
        label="Operations notes"
        value={o.operations_notes}
        onChange={(v) => set({ operations_notes: v })}
        placeholder="Anything else about day-to-day operations"
        rows={2}
      />
    </div>
  );
}