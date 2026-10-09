import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, Users, Loader2, UserPlus } from "lucide-react";

// The restaurant's saved email groups — e.g. "All Managers". The manager
// names each group and picks who belongs to it; Relay suggests groups
// wherever several email recipients are chosen at once, and expands them to
// the members' real addresses.
export default function GroupsEditor({ restaurantId }) {
  const { toast } = useToast();
  const [groups, setGroups] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    try {
      const [g, c] = await Promise.all([
        base44.entities.ContactGroup.filter({ restaurant_id: restaurantId }, { sort: "name", limit: 100 }),
        base44.entities.Contact.filter({ restaurant_id: restaurantId }, { sort: "name", limit: 200 }),
      ]);
      setGroups(g.items || []);
      setContacts(c.items || []);
    } catch (e) {
      console.error(e);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setMemberIds([]);
    setDialogOpen(true);
  };

  const openEdit = (g) => {
    setEditing(g);
    setName(g.name || "");
    setMemberIds(g.member_ids || []);
    setDialogOpen(true);
  };

  const toggleMember = (id) => {
    setMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const save = async () => {
    if (saving || !name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.ContactGroup.update(editing.id, { name: name.trim(), member_ids: memberIds });
      } else {
        await base44.entities.ContactGroup.create({ restaurant_id: restaurantId, name: name.trim(), member_ids: memberIds });
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast({ title: "Couldn't save the group", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g) => {
    try {
      await base44.entities.ContactGroup.delete(g.id);
      await load();
    } catch (e) {
      toast({ title: "Couldn't remove the group", description: "Please try again.", variant: "destructive" });
    }
  };

  const memberNames = (g) =>
    (g.member_ids || [])
      .map((id) => contacts.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(", ");

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          Named groups Relay suggests when you email several people at once — expanding to their real addresses.
        </p>
        <Button variant="outline" size="sm" onClick={openAdd} disabled={contacts.length === 0}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add group
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !groups || groups.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {contacts.length === 0
              ? "Save some contacts first — then group them."
              : "No groups saved yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {groups.map((g) => (
            <div key={g.id} className="flex items-start gap-3 px-3 py-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {g.name}
                  <span className="ml-2 text-[10px] font-medium text-muted-foreground bg-muted border border-border rounded-full px-1.5 py-0.5">
                    {(g.member_ids || []).length} people
                  </span>
                </p>
                {memberNames(g) && <p className="text-xs text-muted-foreground truncate">{memberNames(g)}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => openEdit(g)} title="Edit">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => remove(g)} title="Remove">
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
            <DialogTitle>{editing ? "Edit group" : "New group"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Group name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. All Managers" autoFocus />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Members</Label>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {contacts.map((c) => (
                  <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={memberIds.includes(c.id)} onCheckedChange={() => toggleMember(c.id)} />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{c.name}</p>
                      {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                    </div>
                  </label>
                ))}
              </div>
              {contacts.length === 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> Save contacts first — groups are built from your contact directory.
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving || !name.trim()}>
                {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                {editing ? "Save changes" : "Create group"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}