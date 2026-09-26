import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// Small shared form fields for the restaurant knowledge editor.

export function TextField({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function TextAreaField({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Textarea
        value={value ?? ""}
        placeholder={placeholder}
        rows={rows}
        className="resize-none"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function SwitchField({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div>
        <Label className="text-sm text-foreground">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}