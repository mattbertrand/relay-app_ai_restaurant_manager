import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, Users, Loader2 } from "lucide-react";

const TEAM_ROLE_IDEAS = [
  "General Manager",
  "Assistant Manager",
  "Banquet Manager",
  "Owner",
  "Chef",
  "Kitchen Manager",
  "Server",
  "Other",
];

const CATEGORIES = [
  { value: "vendor", label: "Vendor" },
  { value: "customer", label: "Customer" },
  { value: "partner", label: "Partner" },
  { value: "organization", label: "Organization" },
  { value: "event", label: "Event contact" },
  { value: "community", label: "Community contact" },
  { value: "leadership", label: "Owner / leadership" },
  { value: "other", label: "Other" },
];

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
CATEGORY_LABELS.team_member = "Team member";

const EMPTY = {
  name: "",
  organization: "",
  role: "",
  category: "other",
  email: "",
  phone: "",
  notes: "",
  active: true,
};

// The restaurant's contact directory editor. teamOnly mode (Settings → Team)
// manages team members; the full mode (Restaurant Profile → Contacts)
// manages everyone else — vendors, customers, partners, organizations.
// Relay suggests these contacts wherever the manager picks an email recipient.
export default function ContactsEditor({ restaurantId, teamOnly = false }) {
  const { toast } = useToast();
  const [contacts, setContacts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) { setLoading(false); return; }
    try {
      const page = await base44.entities.Contact.filter(
        teamOnly
          ? { restaurant_id: restaurantId, category: "team_member" }
          : { restaurant_id: restaurantId, category: { $ne: "team_member" } },
        { sort: "name", limit: 200 }
      );
      setContacts(page.items || []);
    } catch (e) {
      console.error(e);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, teamOnly]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY, category: teamOnly ? "team_member" : "other" });
    setDialogOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name || "",
      organization: c.organization || "",
      role: c.role || "",
      category: c.category || (teamOnly ? "team_member" : "other"),
      email: c.email || "",
      phone: c.phone || "",
      notes: c.notes || "",
      active: c.active !== false,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (saving || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        organization: (form.organization || "").trim(),
        role: (form.role || "").trim(),
        category: teamOnly ? "team_member" : form.category,
        email: (form.email || "").trim(),
        phone: (form.phone || "").trim(),
        notes: (form.notes || "").trim(),
        active: form.active,
      };
      if (editing) {
        await base44.entities.Contact.update(editing.id, payload);
      } else {
        await base44.entities.Contact.create({ restaurant_id: restaurantId, ...payload });
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast({ title: "Couldn't save the contact", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    try {
      await base44.entities.Contact.delete(c.id);
      await load();
    } catch (e) {
      toast({ title: "Couldn't remove the contact", description: "Please try again.", variant: "destructive" });
    }
  };

  const toggleActive = async (c) => {
    try {
      await base44.entities.Contact.update(c.id, { active: c.active === false });
      await load();
    } catch (e) {
      toast({ title: "Couldn't update the contact", description: "Please try again.", variant: "destructive" });
    }
  };

  const emailValid = !form.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          {teamOnly
            ? "People on your team Relay can address — available wherever Relay asks who to email, call, or talk to."
            : "Recurring contacts Relay suggests when you email someone — real addresses, never invented."}
        </p>
        <Button variant="outline" size="sm" onClick={openAdd}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add {teamOnly ? "team member" : "contact"}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !contacts || contacts.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No {teamOnly ? "team members" : "contacts"} saved yet.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-start gap-3 px-3 py-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                {(c.name || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {c.name}
                  {c.active === false && (
                    <span className="ml-2 text-[10px] font-medium text-stone-500 bg-stone-100 border border-stone-200 rounded-full px-1.5 py-0.5">
                      Inactive
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {[c.role, c.organization, !teamOnly && CATEGORY_LABELS[c.category]]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                {c.phone && <p className="text-xs text-muted-foreground truncate">{c.phone}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => openEdit(c)} title="Edit">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => remove(c)} title="Remove">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit" : "Add"} {teamOnly ? "team member" : "contact"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Keith Smith"
                autoFocus
              />
            </div>
            {!teamOnly && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Organization (optional)</Label>
                  <Input
                    value={form.organization}
                    onChange={(e) => setForm({ ...form, organization: e.target.value })}
                    placeholder="e.g. ABC Vendor"
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
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{teamOnly ? "Role (optional)" : "Role / title (optional)"}</Label>
              <Input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder={teamOnly ? "e.g. Banquet Manager" : "e.g. Account Representative"}
                list={teamOnly ? "team-role-ideas" : undefined}
              />
              {teamOnly && (
                <datalist id="team-role-ideas">
                  {TEAM_ROLE_IDEAS.map((r) => <option key={r} value={r} />)}
                </datalist>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. keith@example.com"
              />
              {form.email.trim() && !emailValid && (
                <p className="text-xs text-amber-700">Enter a valid email address — Relay won't invent one.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Phone (optional)</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            {!teamOnly && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label className="text-sm text-foreground">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={save} disabled={saving || !form.name.trim() || !emailValid}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                  {editing ? "Save changes" : "Add"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}