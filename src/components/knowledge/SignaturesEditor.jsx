import React from "react";
import { Textarea } from "@/components/ui/textarea";

// Two signature blocks the manager maintains in the Restaurant Profile: a
// full one for email drafts and a separate, shorter public one for review
// responses. Each individual draft's signature is still editable on the draft
// itself before approval.
export default function SignaturesEditor({ value, onChange }) {
  const setField = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Email signature</label>
        <p className="text-xs text-muted-foreground mb-2">
          Appended to email reply drafts — your name, title, restaurant, email, phone, anything you want.
        </p>
        <Textarea
          rows={4}
          value={value.email_signature || ""}
          onChange={setField("email_signature")}
          placeholder={"Alex Morgan\nGeneral Manager, Oak & Vine\nalex@oakandvine.com · (555) 555-0123"}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Review response signature</label>
        <p className="text-xs text-muted-foreground mb-2">
          A separate, shorter signature for public review responses — review platforms are public, so keep personal
          contact details out if you prefer.
        </p>
        <Textarea
          rows={3}
          value={value.review_signature || ""}
          onChange={setField("review_signature")}
          placeholder={"— Alex, General Manager, Oak & Vine"}
        />
      </div>
    </div>
  );
}