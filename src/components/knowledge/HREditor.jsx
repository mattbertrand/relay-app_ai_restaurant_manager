import React from "react";
import { SwitchField, TextField, TextAreaField } from "./Fields";

// HR & employment context. Used by Relay to understand job-related emails
// (applications, follow-ups, employment questions) — never as customer
// opportunity content.
export default function HREditor({ value, onChange }) {
  const hr = value.hr || {};
  const set = (patch) => onChange({ ...value, hr: { ...hr, ...patch } });

  return (
    <div className="space-y-4">
      <SwitchField
        label="Currently hiring"
        description="Turn on when you have open positions — Relay then answers hiring questions with your verified details."
        checked={!!hr.hiring}
        onChange={(v) => set({ hiring: v })}
      />
      {hr.hiring && (
        <TextField
          label="Positions hiring for"
          value={hr.positions_hiring}
          onChange={(v) => set({ positions_hiring: v })}
          placeholder="e.g. Server (part-time), Line cook"
        />
      )}
      <TextAreaField
        label="How to apply"
        value={hr.application_instructions}
        onChange={(v) => set({ application_instructions: v })}
        placeholder="e.g. Email a resume with the position in the subject line"
        rows={2}
      />
      <div className="grid sm:grid-cols-2 gap-4">
        <TextField
          label="Application email"
          value={hr.application_email}
          onChange={(v) => set({ application_email: v })}
          placeholder="e.g. jobs@yourrestaurant.com"
          type="email"
        />
        <TextField
          label="Application method"
          value={hr.application_method}
          onChange={(v) => set({ application_method: v })}
          placeholder="e.g. Email, in person, job board"
        />
      </div>
      <TextAreaField
        label="Interview process"
        value={hr.interview_process}
        onChange={(v) => set({ interview_process: v })}
        placeholder="e.g. Phone screen first, then an in-person trial shift"
        rows={2}
      />
      <div className="grid sm:grid-cols-2 gap-4">
        <TextField
          label="Hiring contact"
          value={hr.hiring_contact}
          onChange={(v) => set({ hiring_contact: v })}
          placeholder="e.g. Sam, General Manager"
        />
        <TextField
          label="Employee inquiry contact"
          value={hr.employee_inquiry_contact}
          onChange={(v) => set({ employee_inquiry_contact: v })}
          placeholder="e.g. hr@yourrestaurant.com"
        />
      </div>
      <TextAreaField
        label="HR notes"
        value={hr.hr_notes}
        onChange={(v) => set({ hr_notes: v })}
        placeholder="Anything else about employment at your restaurant"
        rows={2}
      />
    </div>
  );
}