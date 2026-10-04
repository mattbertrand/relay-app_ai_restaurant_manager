import React, { useState } from "react";
import { TextField, TextAreaField, SwitchField } from "@/components/knowledge/Fields";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

function emptyTemplate() {
  return {
    name: "",
    inquiry_category: "",
    description: "",
    when_to_use: "",
    response_guidance: "",
    info_to_collect: "",
    recommended_next_action: "",
    handoff_to: "",
    handoff_contact: "",
    active: true,
  };
}

// Restaurant-specific response templates — how THIS restaurant handles its
// common inquiries (Dine & Donate, private events, ADA seating, catering,
// sponsorship, …). Guidance Relay follows when analyzing and drafting:
// recommend, never automatically send or forward.
export default function ResponseTemplatesEditor({ value, onChange }) {
  const templates = Array.isArray(value) ? value : [];
  const [openIdx, setOpenIdx] = useState(null);

  const update = (idx, field) => (v) =>
    onChange(templates.map((t, i) => (i === idx ? { ...t, [field]: v } : t)));

  const addTemplate = () => {
    onChange([...templates, emptyTemplate()]);
    setOpenIdx(templates.length);
  };

  const removeTemplate = (idx) => {
    onChange(templates.filter((_, i) => i !== idx));
    if (openIdx === idx) setOpenIdx(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Describe the inquiries your restaurant receives often and how you handle them — what Relay
        should answer right away, what to collect from the customer, and when to hand the matter to
        someone else. Relay follows this guidance in its analysis and drafts, and always recommends
        the next step for you to approve — it never sends or forwards anything on its own.
      </p>
      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground bg-muted/40 border border-border rounded-lg p-3">
          No templates yet — add one for each inquiry you handle often.
        </p>
      )}
      {templates.map((t, idx) => {
        const open = openIdx === idx;
        return (
          <div key={idx} className="rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                onClick={() => setOpenIdx(open ? null : idx)}
                className="flex-1 flex items-center gap-2 text-left min-w-0"
              >
                {open ? (
                  <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-foreground truncate">
                  {t.name || "Untitled template"}
                </span>
                {t.inquiry_category && (
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                    · {t.inquiry_category}
                  </span>
                )}
              </button>
              <span
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded-full border whitespace-nowrap",
                  t.active === false
                    ? "text-stone-500 bg-stone-50 border-stone-200"
                    : "text-emerald-700 bg-emerald-50 border-emerald-200"
                )}
              >
                {t.active === false ? "Inactive" : "Active"}
              </span>
              <button
                onClick={() => removeTemplate(idx)}
                className="text-muted-foreground hover:text-destructive flex-shrink-0"
                title="Remove template"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {open && (
              <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <TextField
                    label="Template name"
                    value={t.name}
                    onChange={update(idx, "name")}
                    placeholder="e.g. Dine & Donate Request"
                  />
                  <TextField
                    label="Inquiry / category"
                    value={t.inquiry_category}
                    onChange={update(idx, "inquiry_category")}
                    placeholder="e.g. Fundraiser request"
                  />
                </div>
                <TextAreaField
                  label="Description"
                  rows={2}
                  value={t.description}
                  onChange={update(idx, "description")}
                  placeholder="What this kind of inquiry is about."
                />
                <TextAreaField
                  label="When to use"
                  rows={2}
                  value={t.when_to_use}
                  onChange={update(idx, "when_to_use")}
                  placeholder="When an incoming email matches this template."
                />
                <TextAreaField
                  label="Response guidance / template"
                  rows={4}
                  value={t.response_guidance}
                  onChange={update(idx, "response_guidance")}
                  placeholder="How this restaurant normally responds — what can be answered immediately and the shape of the reply."
                />
                <TextAreaField
                  label="Information Relay should collect from the customer"
                  rows={2}
                  value={t.info_to_collect}
                  onChange={update(idx, "info_to_collect")}
                  placeholder="e.g. organization name, event date, expected guests, tax ID"
                />
                <TextField
                  label="Recommended next action"
                  value={t.recommended_next_action}
                  onChange={update(idx, "recommended_next_action")}
                  placeholder="e.g. Collect the required details, then hand off to the Banquet Manager"
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <TextField
                    label="Handoff to (optional)"
                    value={t.handoff_to}
                    onChange={update(idx, "handoff_to")}
                    placeholder="e.g. Banquet Manager"
                  />
                  <TextField
                    label="Handoff contact (optional)"
                    value={t.handoff_contact}
                    onChange={update(idx, "handoff_contact")}
                    placeholder="e.g. events@yourrestaurant.com"
                  />
                </div>
                <SwitchField
                  label="Active"
                  description="Inactive templates are ignored by Relay's analysis."
                  checked={t.active !== false}
                  onChange={(v) => update(idx, "active")(v)}
                />
              </div>
            )}
          </div>
        );
      })}
      <Button variant="outline" size="sm" onClick={addTemplate}>
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Add template
      </Button>
    </div>
  );
}