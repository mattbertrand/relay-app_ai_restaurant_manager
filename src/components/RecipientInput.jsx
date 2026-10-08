import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Recipient resolution for email follow-ups and drafts. As the manager types
// a name, saved contacts are suggested — picking one fills the real email
// address Relay already knows. Typing an email address directly works too and
// is validated. Relay never invents an address, and a manually entered
// recipient can be saved to the directory.
export default function RecipientInput({
  restaurantId,
  name,
  email,
  onNameChange,
  onEmailChange,
  disabled,
  placeholder = "Who should receive it — e.g. Keith, Banquet Manager",
  autoFocus,
}) {
  const { toast } = useToast();
  const [matches, setMatches] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [knownContact, setKnownContact] = useState(false);
  const wrapRef = useRef(null);
  const seqRef = useRef(0);
  const pickedNameRef = useRef("");

  useEffect(() => {
    const q = String(name || "").trim();
    // A just-picked contact's full name still matches the typed text —
    // suppress suggestions for it so the list doesn't reopen after picking.
    if (!q || q.includes("@") || !restaurantId || q.toLowerCase() === pickedNameRef.current) {
      setMatches([]);
      setOpen(false);
      return;
    }
    const seq = ++seqRef.current;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const page = await base44.entities.Contact.filter(
          { restaurant_id: restaurantId, active: { $ne: false }, name: { $regex: q, $options: "i" } },
          { limit: 6 }
        );
        if (seqRef.current === seq) {
          setMatches(page.items || []);
          setOpen((page.items || []).length > 0);
        }
      } catch (e) {
        /* suggestions are best-effort */
      } finally {
        if (seqRef.current === seq) setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [name, restaurantId]);

  // Whether this email is already in the directory — "Save as contact" only
  // appears for recipients Relay doesn't know yet.
  useEffect(() => {
    const e = String(email || "").trim();
    if (!EMAIL_RE.test(e) || !restaurantId) {
      setKnownContact(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const esc = e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const page = await base44.entities.Contact.filter(
          { restaurant_id: restaurantId, email: { $regex: `^${esc}$`, $options: "i" } },
          { limit: 1 }
        );
        if (!cancelled) setKnownContact((page.items || []).length > 0);
      } catch {
        if (!cancelled) setKnownContact(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [email, restaurantId]);

  // Outside click closes the suggestion list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (c) => {
    pickedNameRef.current = String(c.name || "").toLowerCase();
    onNameChange(c.name || "");
    if (c.email) onEmailChange(c.email);
    setMatches([]);
    setOpen(false);
  };

  const typedIsEmail = String(name || "").includes("@");
  const typedEmailValid = typedIsEmail && EMAIL_RE.test(String(name).trim());

  const saveContact = async () => {
    if (savingContact) return;
    setSavingContact(true);
    try {
      const existing = await base44.entities.Contact.filter(
        { restaurant_id: restaurantId, email: String(email || "").trim() },
        { limit: 1 }
      );
      if (existing.items && existing.items.length) {
        await base44.entities.Contact.update(existing.items[0].id, {
          name: String(name).trim(),
          active: true,
        });
      } else {
        await base44.entities.Contact.create({
          restaurant_id: restaurantId,
          name: String(name).trim(),
          email: String(email).trim(),
          category: "other",
          active: true,
        });
      }
      setKnownContact(true);
      toast({ title: "Contact saved", description: "Relay will suggest them next time you email someone." });
    } catch (e) {
      toast({ title: "Couldn't save the contact", description: "Please try again.", variant: "destructive" });
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onFocus={() => matches.length && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
        />
        {searching && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
        )}
      </div>
      {typedIsEmail && (
        <p className={cn("text-xs mt-1", typedEmailValid ? "text-muted-foreground" : "text-amber-700")}>
          {typedEmailValid
            ? "This will be used as the recipient's email address."
            : "Enter a valid email address — Relay won't invent one."}
        </p>
      )}
      {open && matches.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-card rounded-lg border border-border shadow-lg overflow-hidden">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c)}
              className="w-full flex items-start gap-3 px-3 py-2 hover:bg-muted/40 transition-colors text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[c.role, c.organization].filter(Boolean).join(" · ")}
                </p>
              </div>
              {c.email && <span className="text-xs text-muted-foreground truncate max-w-[45%]">{c.email}</span>}
            </button>
          ))}
        </div>
      )}
      {email && EMAIL_RE.test(String(email)) && !knownContact && (
        <button
          type="button"
          onClick={saveContact}
          disabled={savingContact || disabled}
          className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {savingContact ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
          Save as contact
        </button>
      )}
    </div>
  );
}