import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getRestaurantId } from "@/lib/format";
import { knowledgeWithDefaults } from "@/lib/knowledge";
import KnowledgeSection from "@/components/knowledge/KnowledgeSection";
import HoursEditor from "@/components/knowledge/HoursEditor";
import ReservationsEditor from "@/components/knowledge/ReservationsEditor";
import EventsCateringEditor from "@/components/knowledge/EventsCateringEditor";
import OfferingsEditor from "@/components/knowledge/OfferingsEditor";
import MenuPoliciesEditor from "@/components/knowledge/MenuPoliciesEditor";
import { TextField } from "@/components/knowledge/Fields";
import { Button } from "@/components/ui/button";
import {
  Save, Loader2, Check, MapPin, Clock, CalendarCheck, PartyPopper,
  UtensilsCrossed, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { setUnsavedChanges, clearUnsavedChanges } from "@/lib/unsavedChanges";

const SECTIONS = [
  { id: "basics", label: "Basics", icon: MapPin, title: "Basic restaurant information", description: "Address and contact details Relay can use to answer customer questions." },
  { id: "hours", label: "Hours", icon: Clock, title: "Operating hours", description: "Regular weekly hours plus temporary and special hours." },
  { id: "reservations", label: "Reservations", icon: CalendarCheck, title: "Reservations", description: "Party-size limits and reservation rules, used when analyzing reservation requests." },
  { id: "events", label: "Events & Catering", icon: PartyPopper, title: "Private events & catering", description: "What you can accommodate — Relay checks this before assuming a request is possible." },
  { id: "offerings", label: "Happy Hour & Recurring", icon: UtensilsCrossed, title: "Happy hour & recurring offerings", description: "Happy hour, brunch, live music, trivia, and other regular happenings." },
  { id: "menu", label: "Menu & Policies", icon: UtensilsCrossed, title: "Menu, offerings & policies", description: "Dietary options, policies, and answers to common customer questions." },
];

export default function RestaurantKnowledge() {
  const { user } = useAuth();
  const [knowledge, setKnowledge] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const rid = getRestaurantId(user);
      if (!rid) return;
      const records = await base44.entities.RestaurantKnowledge.filter({ restaurant_id: rid }, null, 5);
      const record = records[0] || null;
      setRecordId(record ? record.id : null);
      setKnowledge(knowledgeWithDefaults(record));
      setBaseline(JSON.stringify(knowledgeWithDefaults(record)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const setField = (field) => (v) => setKnowledge((k) => ({ ...k, [field]: v }));

  const handleSave = async () => {
    if (saving) return false;
    setSaving(true);
    try {
      const rid = getRestaurantId(user);
      const payload = { ...knowledge, restaurant_id: rid };
      if (recordId) {
        await base44.entities.RestaurantKnowledge.update(recordId, payload);
      } else {
        const created = await base44.entities.RestaurantKnowledge.create(payload);
        setRecordId(created.id);
      }
      setBaseline(JSON.stringify(payload));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      return true;
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const dirty = !!knowledge && !!baseline && JSON.stringify(knowledge) !== baseline;

  // Block navigation away while there are unsaved edits — the shared guard
  // offers to save them first.
  useEffect(() => {
    if (!dirty) return;
    setUnsavedChanges({
      isDirty: () => JSON.stringify(knowledge) !== baseline,
      save: async () => {
        const ok = await handleSave();
        if (!ok) throw new Error("Save failed");
      },
    });
    return () => clearUnsavedChanges();
  });

  if (loading || !knowledge) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto pb-20 md:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">Restaurant Knowledge</h1>
          <p className="text-muted-foreground text-sm mt-1">
            The verified facts Relay uses to understand and answer customer emails.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Save knowledge</>
            )}
          </Button>
          {saved && (
            <span className="text-sm text-emerald-600 flex items-center gap-1">
              <Check className="w-4 h-4" /> Saved
            </span>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-4 mb-6">
        <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          Everything here is <span className="text-foreground font-medium">verified information you provide</span>.
          Relay uses it to recognize customer questions and draft accurate answers — and it never invents
          facts you haven't entered. The more you fill in, the better it can answer on your behalf.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border border-border bg-card text-muted-foreground hover:text-foreground"
          >
            {s.label}
          </a>
        ))}
      </div>

      <div className="space-y-5">
        <KnowledgeSection id="basics" icon={MapPin} title={SECTIONS[0].title} description={SECTIONS[0].description}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <TextField label="Street address" value={knowledge.address} onChange={setField("address")} />
            </div>
            <TextField label="City" value={knowledge.city} onChange={setField("city")} />
            <div className="grid grid-cols-2 gap-4">
              <TextField label="State" value={knowledge.state} onChange={setField("state")} />
              <TextField label="ZIP" value={knowledge.zip} onChange={setField("zip")} />
            </div>
            <TextField label="Phone number" value={knowledge.phone} onChange={setField("phone")} />
            <TextField label="Website" value={knowledge.website} onChange={setField("website")} placeholder="https://" />
            <TextField
              label="General contact email"
              value={knowledge.contact_email}
              onChange={setField("contact_email")}
              type="email"
            />
          </div>
        </KnowledgeSection>

        <KnowledgeSection id="hours" icon={Clock} title={SECTIONS[1].title} description={SECTIONS[1].description}>
          <HoursEditor value={knowledge} onChange={setKnowledge} />
        </KnowledgeSection>

        <KnowledgeSection id="reservations" icon={CalendarCheck} title={SECTIONS[2].title} description={SECTIONS[2].description}>
          <ReservationsEditor value={knowledge} onChange={setKnowledge} />
        </KnowledgeSection>

        <KnowledgeSection id="events" icon={PartyPopper} title={SECTIONS[3].title} description={SECTIONS[3].description}>
          <EventsCateringEditor value={knowledge} onChange={setKnowledge} />
        </KnowledgeSection>

        <KnowledgeSection id="offerings" icon={UtensilsCrossed} title={SECTIONS[4].title} description={SECTIONS[4].description}>
          <OfferingsEditor value={knowledge} onChange={setKnowledge} />
        </KnowledgeSection>

        <KnowledgeSection id="menu" icon={UtensilsCrossed} title={SECTIONS[5].title} description={SECTIONS[5].description}>
          <MenuPoliciesEditor value={knowledge} onChange={setKnowledge} />
        </KnowledgeSection>
      </div>

      <div className="flex items-center gap-3 mt-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Save knowledge</>
          )}
        </Button>
        {saved && (
          <span className="text-sm text-emerald-600 flex items-center gap-1">
            <Check className="w-4 h-4" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}