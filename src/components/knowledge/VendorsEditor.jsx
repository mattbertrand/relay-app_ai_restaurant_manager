import React from "react";
import { Button } from "@/components/ui/button";
import { TextField, TextAreaField, SelectField } from "./Fields";
import { emptyVendor } from "@/lib/knowledge";
import { Plus, Trash2, Building2 } from "lucide-react";

const VENDOR_STATUSES = [
  { value: "", label: "—" },
  { value: "Current", label: "Current vendor" },
  { value: "Onboarding", label: "Onboarding" },
  { value: "Paused", label: "Paused" },
  { value: "Former", label: "Former" },
];

// Known vendors & suppliers. Relay matches a sender's email address (or the
// vendor's name in the message) against this list to recognize communication
// from a vendor you already work with — versus unknown cold outreach.
export default function VendorsEditor({ value, onChange }) {
  const vendors = Array.isArray(value.vendors) ? value.vendors : [];

  const setVendor = (index, patch) => {
    const next = vendors.map((v, i) => (i === index ? { ...v, ...patch } : v));
    onChange({ ...value, vendors: next });
  };
  const addVendor = () => onChange({ ...value, vendors: [...vendors, emptyVendor()] });
  const removeVendor = (index) => {
    onChange({ ...value, vendors: vendors.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add the vendors you already work with. Relay uses this list to recognize their emails — it never
        treats vendor mail as a customer opportunity.
      </p>
      {vendors.length === 0 && (
        <p className="text-sm text-muted-foreground italic py-2">No vendors added yet.</p>
      )}
      {vendors.map((v, i) => (
        <div key={i} className="rounded-lg border border-border p-4 space-y-4 bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              {v.name || `Vendor ${i + 1}`}
            </div>
            <Button variant="ghost" size="sm" onClick={() => removeVendor(i)} className="text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <TextField label="Vendor name" value={v.name} onChange={(x) => setVendor(i, { name: x })} />
            <TextField label="Category" value={v.category} onChange={(x) => setVendor(i, { category: x })} placeholder="e.g. Produce, Beverage, Linens" />
            <TextField label="Contact name" value={v.contact_name} onChange={(x) => setVendor(i, { contact_name: x })} />
            <TextField label="Contact email" value={v.contact_email} onChange={(x) => setVendor(i, { contact_email: x })} type="email" />
            <TextField label="Contact phone" value={v.contact_phone} onChange={(x) => setVendor(i, { contact_phone: x })} />
            <SelectField label="Status" value={v.status} onChange={(x) => setVendor(i, { status: x })} options={VENDOR_STATUSES} />
          </div>
          <TextAreaField
            label="Products / services supplied"
            value={v.products_services}
            onChange={(x) => setVendor(i, { products_services: x })}
            rows={2}
          />
          <TextAreaField
            label="Ordering instructions"
            value={v.ordering_instructions}
            onChange={(x) => setVendor(i, { ordering_instructions: x })}
            placeholder="e.g. Email orders by 3 PM for next-day delivery"
            rows={2}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <TextField label="Delivery schedule" value={v.delivery_schedule} onChange={(x) => setVendor(i, { delivery_schedule: x })} placeholder="e.g. Tue & Fri mornings" />
            <TextField label="Ordering cutoff" value={v.ordering_cutoff} onChange={(x) => setVendor(i, { ordering_cutoff: x })} placeholder="e.g. 3 PM the day before" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <TextField label="Escalation contact" value={v.escalation_contact} onChange={(x) => setVendor(i, { escalation_contact: x })} placeholder="Who to contact about an issue" />
            <TextField label="Notes" value={v.notes} onChange={(x) => setVendor(i, { notes: x })} />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addVendor}>
        <Plus className="w-4 h-4 mr-1.5" /> Add vendor
      </Button>
    </div>
  );
}