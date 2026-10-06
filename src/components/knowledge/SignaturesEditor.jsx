import React from "react";
import { Textarea } from "@/components/ui/textarea";
import RichSignatureEditor from "./RichSignatureEditor";

// Two signature blocks the manager maintains in the Restaurant Profile: a
// rich one for email drafts (paste straight from Gmail/Outlook — formatting
// and images are kept) and a separate, shorter public one for review
// responses. Each individual draft's signature is still editable on the draft
// itself before approval.
export default function SignaturesEditor({ value, onChange }) {
  const setField = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const setRichSignature = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Email signature</label>
        <p className="text-xs text-muted-foreground mb-2">
          Appended to email reply drafts. Copy your existing signature from Gmail or Outlook and
          paste it here — formatting, links, and your logo are kept.
        </p>
        <RichSignatureEditor value={value} onChange={setRichSignature} />
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