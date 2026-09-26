import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { getUnsavedChanges } from "@/lib/unsavedChanges";

// Blocks in-app navigation (link clicks) and tab close while the current
// page has unsaved edits, and asks whether to save them first.
export default function UnsavedChangesGuard() {
  const navigate = useNavigate();
  const [pendingHref, setPendingHref] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // Intercept clicks on in-app links (rendered as <a href="/...">) when the
  // page registered unsaved edits. Capture phase + stopPropagation so React
  // Router's own link handler never fires.
  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const reg = getUnsavedChanges();
      if (!reg || !reg.isDirty()) return;
      const a = e.target.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      if (href === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setSaveFailed(false);
      setPendingHref(href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Warn before closing or refreshing the tab with unsaved edits
  useEffect(() => {
    const onBeforeUnload = (e) => {
      const reg = getUnsavedChanges();
      if (reg && reg.isDirty()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const close = () => {
    if (saving) return;
    setPendingHref(null);
    setSaveFailed(false);
  };

  const handleSaveAndLeave = async () => {
    const reg = getUnsavedChanges();
    if (!reg) { setPendingHref(null); return; }
    setSaving(true);
    setSaveFailed(false);
    try {
      await reg.save();
      const href = pendingHref;
      setSaving(false);
      setPendingHref(null);
      navigate(href);
    } catch (err) {
      console.error(err);
      setSaving(false);
      setSaveFailed(true);
    }
  };

  const handleLeaveWithoutSaving = () => {
    const href = pendingHref;
    setPendingHref(null);
    navigate(href);
  };

  return (
    <Dialog open={!!pendingHref} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>You have unsaved changes</DialogTitle>
          <DialogDescription>
            {saveFailed
              ? "We couldn't save your changes. Try again, leave without saving, or stay on this page."
              : "Do you want to save your changes before leaving this page?"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:space-x-2 gap-2">
          <Button variant="ghost" onClick={handleLeaveWithoutSaving} disabled={saving}>
            Leave without saving
          </Button>
          <Button variant="outline" onClick={close} disabled={saving}>
            Stay on this page
          </Button>
          <Button onClick={handleSaveAndLeave} disabled={saving}>
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Save and leave</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}