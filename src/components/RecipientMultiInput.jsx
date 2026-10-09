import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "Keith <keith@example.com>, jane@example.com, Dana" → [{name, email}]
export function parseRecipientText(text) {
  return String(text || "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.*?)\s*<\s*([^>]+)\s*>$/);
      if (m) return { name: m[1].trim(), email: m[2].trim() };
      if (EMAIL_RE.test(part)) return { name: part, email: part };
      return { name: part, email: "" };
    });
}

export function joinNames(recipients) {
  return (recipients || []).map((r) => (r.name || r.email || "").trim()).filter(Boolean).join(", ");
}

export function joinEmails(recipients) {
  return (recipients || []).map((r) => (r.email || "").trim()).filter(Boolean).join(", ");
}

// Every chip needs a real address before an email can be recorded as sent —
// Relay never invents one.
export function allHaveEmails(recipients) {
  return (recipients || []).length > 0 && (recipients || []).every((r) => EMAIL_RE.test((r.email || "").trim()));
}

const chipKey = (c) => String((c.email || c.name || "")).toLowerCase();

// Multi-recipient input with chips: type a name and/or address and press Enter,
// or pick from saved contacts and saved groups (a group expands to its
// members). A chip without a real address is flagged — it can't be recorded
// as sent until the manager supplies one.
export default function RecipientMultiInput({ restaurantId, value, onChange, placeholder, disabled, autoFocus }) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    Promise.all([
      base44.entities.Contact.filter({ restaurant_id: restaurantId }, { sort: "name", limit: 200 }),
      base44.entities.ContactGroup.filter({ restaurant_id: restaurantId }, { sort: "name", limit: 100 }),
    ])
      .then(([c, g]) => {
        if (!cancelled) {
          setContacts(c.items || []);
          setGroups(g.items || []);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = input.trim().toLowerCase();
  const existing = useMemo(() => new Set(value.map(chipKey).filter(Boolean)), [value]);
  const contactMatches = useMemo(() => {
    if (!q) return [];
    return contacts
      .filter(
        (c) =>
          !existing.has((c.email || "").toLowerCase()) &&
          [c.name, c.email, c.organization, c.role].some((f) => (f || "").toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [q, contacts, existing]);
  const groupMatches = useMemo(() => {
    if (!q) return [];
    return groups.filter((g) => (g.name || "").toLowerCase().includes(q)).slice(0, 3);
  }, [q, groups]);

  const addChips = (chips) => {
    const merged = [...value];
    const seen = new Set(existing);
    chips.forEach((c) => {
      const k = chipKey(c);
      if (k && !seen.has(k)) {
        seen.add(k);
        merged.push({ name: c.name || "", email: c.email || "" });
      }
    });
    onChange(merged);
    setInput("");
    setOpen(false);
  };

  const addGroup = (g) => {
    const ids = g.member_ids || [];
    addChips(
      contacts.filter((c) => ids.includes(c.id)).map((m) => ({ name: m.name || "", email: m.email || "" }))
    );
  };

  const commitInput = () => {
    const parsed = parseRecipientText(input);
    if (parsed.length) addChips(parsed);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitInput();
    } else if (e.key === "Backspace" && !input && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div ref={boxRef} className="relative" onClick={() => setOpen(true)}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 w-full min-h-[38px] rounded-md border border-input bg-card px-2 py-1.5 cursor-text",
          disabled && "opacity-50 pointer-events-none"
        )}
      >
        {value.map((r, i) => {
          const bad = !EMAIL_RE.test((r.email || "").trim());
          return (
            <span
              key={i}
              title={bad ? "No real email address yet — Relay won't invent one" : undefined}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs max-w-full",
                bad ? "border-amber-300 bg-amber-50 text-amber-800" : "border-border bg-secondary text-foreground"
              )}
            >
              <span className="truncate">{r.name || r.email}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((_, j) => j !== i));
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}
        <input
          className="flex-1 min-w-[140px] bg-transparent text-sm py-0.5 focus:outline-none"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            if (input.trim()) commitInput();
          }}
          placeholder={value.length ? "" : placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      </div>
      {open && (contactMatches.length > 0 || groupMatches.length > 0 || q) && (
        <div className="absolute z-40 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-64 overflow-y-auto py-1">
          {groupMatches.map((g) => (
            <button
              key={g.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
              onClick={() => addGroup(g)}
            >
              <Users className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-foreground">{g.name}</span>
              <span className="text-xs text-muted-foreground">Group · {(g.member_ids || []).length} saved</span>
            </button>
          ))}
          {contactMatches.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
              onClick={() => addChips([{ name: c.name || "", email: c.email || "" }])}
            >
              <span className="font-medium text-foreground">{c.name}</span>
              {c.email && <span className="text-xs text-muted-foreground truncate">{c.email}</span>}
            </button>
          ))}
          {q && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className="w-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted text-left"
              onClick={commitInput}
            >
              Add “{input.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}