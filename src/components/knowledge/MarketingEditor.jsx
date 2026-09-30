import React from "react";
import { TextField, TextAreaField } from "./Fields";

// Marketing context — restaurant-specific information only. No external
// integrations: Relay uses these facts when an email touches promotions,
// social media, or brand questions.
export default function MarketingEditor({ value, onChange }) {
  const mk = value.marketing || {};
  const set = (patch) => onChange({ ...value, marketing: { ...mk, ...patch } });

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <TextField
          label="Social media accounts"
          value={mk.social_media}
          onChange={(v) => set({ social_media: v })}
          placeholder="e.g. Instagram @yourrestaurant"
        />
        <TextField
          label="Marketing contact"
          value={mk.marketing_contact}
          onChange={(v) => set({ marketing_contact: v })}
          placeholder="Who handles marketing"
        />
      </div>
      <TextAreaField
        label="Current promotions"
        value={mk.current_promotions}
        onChange={(v) => set({ current_promotions: v })}
        placeholder="Promotions running right now, or 'None at the moment'"
        rows={2}
      />
      <TextAreaField
        label="Recurring promotions"
        value={mk.recurring_promotions}
        onChange={(v) => set({ recurring_promotions: v })}
        placeholder="e.g. Monthly wine dinner"
        rows={2}
      />
      <TextAreaField
        label="Brand guidelines"
        value={mk.brand_guidelines}
        onChange={(v) => set({ brand_guidelines: v })}
        placeholder="Tone, phrasing, or anything communications should reflect"
        rows={2}
      />
      <TextAreaField
        label="Marketing notes"
        value={mk.marketing_notes}
        onChange={(v) => set({ marketing_notes: v })}
        placeholder="Anything else about your marketing"
        rows={2}
      />
    </div>
  );
}