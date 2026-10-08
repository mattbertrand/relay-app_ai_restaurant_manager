import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { UserPlus, Loader2 } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CATEGORIES = [
  { value: "customer", label: "Customer" },
  { value: "vendor", label: "Vendor" },
  { value: "partner", label: "Partner" },
  { value: "organization", label: "Organization" },
  { value: "event", label: "Event contact" },
  { value: "community", label: "Community contact" },
  { value: "leadership", label: "Owner / leadership" },
  { value: "team_member", label: "Team member" },
  { value: "other", label: "Other" },
];

// A lightweight "Save as contact" action beside a real email sender. Prefills
// what Relay already knows (name, email, organization when available); the
// manager picks the category and confirms. Relay only ever saves a contact
// when the manager explicitly chooses to — never automatically.
export default function SaveContactButton({ restaurantId, name, email, organization }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const openDialog = () => {
    setForm({
      name: name || "",
      email: email || "",
      organization: organization || "",
      category: "customer",
    });
    setOpen(true);
  };

  const save = async () => {
    if (saving || !form.name.trim() || !EMAIL_RE.test(form.email.trim())) return;
    setSaving(true);
    try {
      const existing = await base44.entities.Contact.filter(
        { restaurant_id: restaurantId, email: form.email.trim() },
        { limit: 1 }
      );
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        organization: (form.organization || "").trim(),
        category: form.category,
        active: true,
      };
      if (existing.items && existing.items.length) {
        await base44.entities.Contact.update(existing.items[0].id, payload);
      } else {
        await base44.entities.Contact.create({ restaurant_id: restaurantId, ...payload });
      }
      toast({ title: "Contact saved", description: "Relay will suggest them next time you email someone." });
      setOpen(false);
    } catch (e) {
      toast({ title: "Couldn't save the contact", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!email || !EMAIL_RE.test(email.trim())) return null;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <UserPlus className="w-3 h-3" /> Save as contact
      </button>
      {open && form && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Save as contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Organization (optional)</Label>
                <Input
                  value={form.organization}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="h-9 w-full appearance-none rounded-md border border-input bg-card px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={save} disabled={saving || !form.name.trim() || !EMAIL_RE.test(form.email.trim())}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                  Save contact
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}