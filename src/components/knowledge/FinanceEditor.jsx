import React from "react";
import { TextField, TextAreaField } from "./Fields";

// Finance & billing context. Trusted context only — Relay is not an
// accounting system. It uses these facts to understand invoice and billing
// emails, never to move money.
export default function FinanceEditor({ value, onChange }) {
  const f = value.finance || {};
  const set = (patch) => onChange({ ...value, finance: { ...f, ...patch } });

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <TextField
          label="Accounting contact"
          value={f.accounting_contact}
          onChange={(v) => set({ accounting_contact: v })}
          placeholder="e.g. bookkeeping@yourrestaurant.com"
        />
        <TextField
          label="Invoice contact"
          value={f.invoice_contact}
          onChange={(v) => set({ invoice_contact: v })}
          placeholder="Who handles invoices"
        />
        <TextField
          label="Billing email"
          value={f.billing_email}
          onChange={(v) => set({ billing_email: v })}
          placeholder="e.g. invoices@yourrestaurant.com"
          type="email"
        />
        <TextField
          label="Payment deadlines"
          value={f.payment_deadlines}
          onChange={(v) => set({ payment_deadlines: v })}
          placeholder="e.g. Invoices paid within 30 days"
        />
      </div>
      <TextAreaField
        label="Invoice submission procedure"
        value={f.invoice_submission_procedure}
        onChange={(v) => set({ invoice_submission_procedure: v })}
        placeholder="e.g. Email invoices to the billing address"
        rows={2}
      />
      <TextAreaField
        label="Payment procedure"
        value={f.payment_procedure}
        onChange={(v) => set({ payment_procedure: v })}
        placeholder="e.g. Paid by check weekly on Fridays"
        rows={2}
      />
      <TextAreaField
        label="Payment approval requirements"
        value={f.payment_approval_requirements}
        onChange={(v) => set({ payment_approval_requirements: v })}
        placeholder="e.g. Invoices over $500 need manager approval before payment"
        rows={2}
      />
      <TextAreaField
        label="Finance notes"
        value={f.finance_notes}
        onChange={(v) => set({ finance_notes: v })}
        placeholder="Anything else about billing and payments"
        rows={2}
      />
    </div>
  );
}