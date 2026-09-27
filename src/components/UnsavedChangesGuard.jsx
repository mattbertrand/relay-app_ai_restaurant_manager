import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { getUnsavedChanges, clearUnsavedChanges, onUnsavedChangesChange } from "@/lib/unsavedChanges";

// Blocks navigation away from the current page while it has unsaved edits —
// in-app links and the browser Back button — and asks what to do: stay, leave
// without saving, or save first. A single instance lives in the app layout, so
// the dialog never duplicates, and it only appears when there are real unsaved
// edits (the page's isDirty check).
export default function UnsavedChangesGuard() {
  const navigate = useNavigate();
  const [pendingHref, setPendingHref] = useState(null); // link-click navigation
  const [backPending, setBackPending] = useState(false); // Back-button navigation
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const sentinelRef = useRef(false);

  const open = !!pendingHref || backPending;

  // While there are unsaved edits, keep an extra history entry on the same
  // URL so a Back press lands on this page (not away from it) and the dialog
  // can ask what to do.
  useEffect(
    () =>
      onUnsavedChangesChange((reg) => {
        if (reg && reg.isDirty() && !sentinelRef.current && window.history) {
          try {
            window.history.pushState(
              { ...(window.history.state || {}), relayUnsavedGuard: true },
              "",
              window.location.href
            );
            sentinelRef.current = true;
          } catch (e) {
            /* history unsupported — in-app links are still guarded */
          }
        }
      }),
    []
  );

  // Back press while there are unsaved edits: re-anchor the extra entry and
  // ask instead of letting the browser navigate away from the page.
  useEffect(() => {
    const onPopState = () => {
      const reg = getUnsavedChanges();
      if (!reg || !reg.isDirty()) {
        sentinelRef.current = false;
        return;
      }
      if (!sentinelRef.current) return;
      try {
        window.history.pushState(
          { ...(window.history.state || {}), relayUnsavedGuard: true },
          "",
          window.location.href
        );
      } catch (e) {
        return;
      }
      setSaveFailed(false);
      setPendingHref(null);
      setBackPending(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
      setBackPending(false);
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
    setBackPending(false);
    setSaveFailed(false);
  };

  const handleSaveAndLeave = async () => {
    const reg = getUnsavedChanges();
    if (!reg) { close(); return; }
    setSaving(true);
    setSaveFailed(false);
    try {
      await reg.save();
      setSaving(false);
      clearUnsavedChanges();
      if (backPending) {
        // Past the extra history entry and the page entry before it.
        setBackPending(false);
        window.history.go(-2);
      } else {
        const href = pendingHref;
        setPendingHref(null);
        navigate(href);
      }
    } catch (err) {
      console.error(err);
      setSaving(false);
      setSaveFailed(true);
    }
  };

  const handleLeaveWithoutSaving = () => {
    if (backPending) {
      clearUnsavedChanges();
      setBackPending(false);
      window.history.go(-2);
    } else {
      const href = pendingHref;
      setPendingHref(null);
      navigate(href);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unsaved changes</DialogTitle>
          <DialogDescription>
            {saveFailed
              ? "We couldn't save your changes. Try again, leave without saving, or stay on this page."
              : "You have unsaved changes. What would you like to do?"}
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