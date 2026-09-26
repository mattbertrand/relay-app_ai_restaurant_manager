import React from "react";
import { SwitchField, TextField, TextAreaField } from "./Fields";

// Private events and catering — Relay checks these before assuming whether a
// request can be accommodated, and never invents capacity or policies.
export default function EventsCateringEditor({ value, onChange }) {
  const p = value.private_events || {};
  const c = value.catering || {};
  const setEvents = (patch) => onChange({ ...value, private_events: { ...p, ...patch } });
  const setCatering = (patch) => onChange({ ...value, catering: { ...c, ...patch } });

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Private events</h3>
        <SwitchField
          label="We offer private events"
          checked={!!p.offered}
          onChange={(v) => setEvents({ offered: v })}
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField
            label="Minimum capacity"
            value={p.min_capacity}
            onChange={(v) => setEvents({ min_capacity: v })}
            placeholder="e.g. 12 guests"
          />
          <TextField
            label="Maximum capacity"
            value={p.max_capacity}
            onChange={(v) => setEvents({ max_capacity: v })}
            placeholder="e.g. 60 guests"
          />
          <TextField
            label="Types of events accepted"
            value={p.event_types}
            onChange={(v) => setEvents({ event_types: v })}
            placeholder="e.g. birthdays, corporate dinners, wedding rehearsals"
          />
          <TextField
            label="Private dining options"
            value={p.private_dining_options}
            onChange={(v) => setEvents({ private_dining_options: v })}
            placeholder="e.g. Main dining room, patio, chef's table"
          />
        </div>
        <TextAreaField
          label="Event policies"
          value={p.policies}
          onChange={(v) => setEvents({ policies: v })}
        />
        <TextAreaField
          label="Booking process"
          value={p.booking_process}
          onChange={(v) => setEvents({ booking_process: v })}
          placeholder="e.g. Email events@… for a proposal; 50% deposit to confirm"
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField
            label="Event contact"
            value={p.contact}
            onChange={(v) => setEvents({ contact: v })}
          />
          <TextField
            label="Pricing information (optional)"
            value={p.pricing}
            onChange={(v) => setEvents({ pricing: v })}
            placeholder="Only if you want Relay to know it"
          />
        </div>
      </div>

      <div className="space-y-4 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Catering</h3>
        <SwitchField
          label="We offer catering"
          checked={!!c.offered}
          onChange={(v) => setCatering({ offered: v })}
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField
            label="Types of catering"
            value={c.types}
            onChange={(v) => setCatering({ types: v })}
            placeholder="e.g. Corporate luncheons, family-style trays, drop-off catering"
          />
          <TextField
            label="Service area"
            value={c.service_area}
            onChange={(v) => setCatering({ service_area: v })}
            placeholder="e.g. Within 10 miles of the restaurant"
          />
          <TextField
            label="Minimum guest count"
            value={c.min_guests}
            onChange={(v) => setCatering({ min_guests: v })}
          />
          <TextField
            label="Maximum guest count"
            value={c.max_guests}
            onChange={(v) => setCatering({ max_guests: v })}
          />
        </div>
        <TextAreaField
          label="Catering policies"
          value={c.policies}
          onChange={(v) => setCatering({ policies: v })}
        />
        <TextAreaField
          label="Booking process"
          value={c.booking_process}
          onChange={(v) => setCatering({ booking_process: v })}
          placeholder="e.g. 72 hours notice; order via phone or email"
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField
            label="Catering contact"
            value={c.contact}
            onChange={(v) => setCatering({ contact: v })}
          />
          <TextField
            label="Pricing information (optional)"
            value={c.pricing}
            onChange={(v) => setCatering({ pricing: v })}
          />
        </div>
      </div>
    </div>
  );
}