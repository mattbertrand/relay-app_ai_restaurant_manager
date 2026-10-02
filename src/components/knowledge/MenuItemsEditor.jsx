import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Upload, Globe, Plus, Pencil, Trash2, UtensilsCrossed } from "lucide-react";

const IMPORT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.json,.txt";

const ORIGIN_LABELS = { upload: "Uploaded", website: "Website", manual: "Added by you" };

// The restaurant's structured menu items. Items are imported from an uploaded
// menu file or pulled from the restaurant's website, then each item can be
// edited, added or removed directly — a small menu change never requires
// re-uploading the whole menu. Items save immediately; Relay reads them when
// answering menu questions.
export default function MenuItemsEditor({ restaurantId }) {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(null); // 'file' | 'website' | null
  const [importError, setImportError] = useState(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const loadItems = useCallback(async () => {
    try {
      const page = await base44.entities.MenuItem.filter(
        { restaurant_id: restaurantId },
        { sort: "position", limit: 500 }
      );
      setItems(page.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file || importing) return;
    setImporting("file");
    setImportError(null);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri });
      const res = await base44.functions.invoke("menuImport", {
        restaurant_id: restaurantId,
        source: "file",
        file_url: signed_url,
        file_uri,
        file_name: file.name,
      });
      if (res.data && res.data.error) {
        setImportError(res.data.error);
      } else {
        toast({
          title: "Menu imported",
          description: `${res.data.imported} item${res.data.imported === 1 ? "" : "s"} added from ${file.name}.`,
        });
        await loadItems();
      }
    } catch (err) {
      console.error(err);
      setImportError("We couldn't read a menu from that file. A clear PDF or photo of the menu works best.");
    } finally {
      setImporting(null);
    }
  };

  const handleWebsite = async () => {
    if (!websiteUrl.trim() || importing) return;
    setImporting("website");
    setImportError(null);
    try {
      const res = await base44.functions.invoke("menuImport", {
        restaurant_id: restaurantId,
        source: "website",
        url: websiteUrl.trim(),
      });
      if (res.data && res.data.error) {
        setImportError(res.data.error);
      } else {
        toast({
          title: "Menu imported",
          description: `${res.data.imported} item${res.data.imported === 1 ? "" : "s"} pulled from your website.`,
        });
        await loadItems();
      }
    } catch (err) {
      console.error(err);
      setImportError("We couldn't pull a menu from that website. Check the address, or upload the menu file instead.");
    } finally {
      setImporting(null);
    }
  };

  const startEdit = (it) => {
    setEditingId(it.id);
    setEditValue({
      section: it.section || "",
      name: it.name || "",
      price: it.price || "",
      dietary: it.dietary || "",
      description: it.description || "",
    });
  };

  const saveEdit = async () => {
    if (!editingId || savingId) return;
    setSavingId(editingId);
    const saved = {
      section: (editValue.section || "").trim() || "Menu",
      name: (editValue.name || "").trim(),
      price: (editValue.price || "").trim(),
      dietary: (editValue.dietary || "").trim(),
      description: (editValue.description || "").trim(),
    };
    try {
      await base44.entities.MenuItem.update(editingId, { ...saved, edited: true });
      setItems((prev) =>
        prev.map((it) => (it.id === editingId ? { ...it, ...saved, edited: true } : it))
      );
      setEditingId(null);
      setEditValue(null);
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't save this item", description: "Please try again.", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const removeItem = async (it) => {
    if (removingId) return;
    setRemovingId(it.id);
    try {
      await base44.entities.MenuItem.delete(it.id);
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't remove this item", description: "Please try again.", variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const addItem = async () => {
    try {
      const position = items.reduce((mx, it) => Math.max(mx, it.position || 0), 0) + 1;
      const created = await base44.entities.MenuItem.create({
        restaurant_id: restaurantId,
        section: "Menu",
        name: "New item",
        origin: "manual",
        position,
      });
      setItems((prev) => [...prev, created]);
      setEditingId(created.id);
      setEditValue({ section: "Menu", name: "", price: "", dietary: "", description: "" });
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't add an item", description: "Please try again.", variant: "destructive" });
    }
  };

  // Group by section, preserving the menu's own order.
  const groups = [];
  const bySection = new Map();
  for (const it of items) {
    const s = it.section || "Menu";
    if (!bySection.has(s)) {
      bySection.set(s, []);
      groups.push(s);
    }
    bySection.get(s).push(it);
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-primary" /> Menu items
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Upload your menu or pull it from your website, then keep items up to date here — Relay uses them to answer
            menu questions.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
        <label className="inline-flex">
          <input type="file" accept={IMPORT_ACCEPT} className="hidden" onChange={handleFile} disabled={!!importing} />
          <Button variant="outline" size="sm" asChild disabled={!!importing}>
            <span className="cursor-pointer">
              {importing === "file" ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reading menu…</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Upload menu file</>
              )}
            </span>
          </Button>
        </label>
        <div className="flex gap-2 items-center flex-1">
          <div className="relative flex-1 max-w-xs">
            <Globe className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="Your website's menu page"
              className="pl-8 h-8 text-sm"
              disabled={!!importing}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleWebsite} disabled={!!importing || !websiteUrl.trim()}>
            {importing === "website" ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Pulling…</>
            ) : (
              "Pull from website"
            )}
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5">
        Re-importing replaces unedited items from the same source — items you've edited, and items you added yourself,
        are always kept.
      </p>
      {importError && <p className="text-xs text-destructive mt-2">{importError}</p>}

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">No menu items yet.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload a menu file or pull from your website to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((section) => (
              <div key={section}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{section}</p>
                <div className="rounded-lg border border-border divide-y divide-border">
                  {bySection.get(section).map((it) =>
                    editingId === it.id ? (
                      <div key={it.id} className="p-3 bg-muted/40 space-y-2">
                        <div className="grid sm:grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Section</Label>
                            <Input
                              value={editValue.section}
                              onChange={(e) => setEditValue({ ...editValue, section: e.target.value })}
                              className="h-8 text-sm mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Item name</Label>
                            <Input
                              value={editValue.name}
                              onChange={(e) => setEditValue({ ...editValue, name: e.target.value })}
                              className="h-8 text-sm mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Price</Label>
                            <Input
                              value={editValue.price}
                              onChange={(e) => setEditValue({ ...editValue, price: e.target.value })}
                              className="h-8 text-sm mt-0.5"
                              placeholder="e.g. 18"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Description</Label>
                          <Textarea
                            value={editValue.description}
                            onChange={(e) => setEditValue({ ...editValue, description: e.target.value })}
                            rows={2}
                            className="text-sm mt-0.5"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Dietary notes</Label>
                          <Input
                            value={editValue.dietary}
                            onChange={(e) => setEditValue({ ...editValue, dietary: e.target.value })}
                            className="h-8 text-sm mt-0.5"
                            placeholder="e.g. vegetarian, gluten-free"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(null);
                              setEditValue(null);
                            }}
                            disabled={!!savingId}
                          >
                            Cancel
                          </Button>
                          <Button size="sm" onClick={saveEdit} disabled={savingId || !editValue.name.trim()}>
                            {savingId === it.id ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                            ) : (
                              "Save item"
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div key={it.id} className="px-3 py-2.5 flex items-start gap-3 group">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {it.name}
                            {it.price ? <span className="text-muted-foreground font-normal"> · {it.price}</span> : null}
                            {it.dietary ? (
                              <span className="text-[11px] text-emerald-700 ml-2">{it.dietary}</span>
                            ) : null}
                            {it.origin !== "manual" && !it.edited ? (
                              <span className="text-[11px] text-muted-foreground ml-2">
                                ({ORIGIN_LABELS[it.origin] || it.origin})
                              </span>
                            ) : null}
                          </p>
                          {it.description ? (
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{it.description}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(it)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeItem(it)}
                            disabled={removingId === it.id}
                          >
                            {removingId === it.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-2" /> Add item
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}