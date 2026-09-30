import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getRestaurantId } from "@/lib/format";
import { knowledgeWithDefaults, profileCompletion } from "@/lib/knowledge";
import KnowledgeSection from "@/components/knowledge/KnowledgeSection";
import HoursEditor from "@/components/knowledge/HoursEditor";
import ReservationsEditor from "@/components/knowledge/ReservationsEditor";
import EventsCateringEditor from "@/components/knowledge/EventsCateringEditor";
import OfferingsEditor from "@/components/knowledge/OfferingsEditor";
import MenuPoliciesEditor from "@/components/knowledge/MenuPoliciesEditor";
import HREditor from "@/components/knowledge/HREditor";
import VendorsEditor from "@/components/knowledge/VendorsEditor";
import FinanceEditor from "@/components/knowledge/FinanceEditor";
import OperationsEditor from "@/components/knowledge/OperationsEditor";
import MarketingEditor from "@/components/knowledge/MarketingEditor";
import { TextField, SelectField } from "@/components/knowledge/Fields";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Save, Loader2, Check, MapPin, Clock, CalendarCheck, PartyPopper,
  UtensilsCrossed, Info, Users, Briefcase, Truck, Wallet, Wrench, Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { setUnsavedChanges, clearUnsavedChanges } from "@/lib/unsavedChanges";

const TIMEZONES = [
  { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
  { value: "America/Denver", label: "Mountain Time (Denver)" },
  { value: "America/Phoenix", label: "Arizona Time (Phoenix)" },
  { value: "America/Chicago", label: "Central Time (Chicago)" },
  { value: "America/New_York", label: "Eastern Time (New York)" },
  { value: "America/Anchorage", label: "Alaska Time (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (Honolulu)" },
];

// Top-level profile groups. Each holds focused section cards — never one
// enormous form. The route stays /knowledge; the concept is now the broader
// Restaurant Profile (the original Restaurant Knowledge sections are the
// Restaurant / Food & Beverage / Reservations & Events / Customers groups).
const GROUPS = [
  {
    id: "restaurant",
    label: "Restaurant",
    icon: MapPin,
    sections: [
      { id: "basics", icon: MapPin, title: "Basic restaurant information", description: "Address and contact details Relay can use to answer customer questions." },
      { id: "hours", icon: Clock, title: "Operating hours", description: "Regular weekly hours plus temporary and special hours." },
    ],
  },
  {
    id: "food",
    label: "Food & Beverage",
    icon: UtensilsCrossed,
    sections: [
      { id: "offerings", icon: UtensilsCrossed, title: "Happy hour & recurring offerings", description: "Happy hour, brunch, live music, trivia, and other regular happenings." },
      { id: "menu", icon: UtensilsCrossed, title: "Menu & dietary information", description: "Dietary options, allergens, and accommodations — Relay checks this before answering dietary questions." },
    ],
  },
  {
    id: "res_events",
    label: "Reservations & Events",
    icon: CalendarCheck,
    sections: [
      { id: "reservations", icon: CalendarCheck, title: "Reservations", description: "Party-size limits and reservation rules, used when analyzing reservation requests." },
      { id: "events", icon: PartyPopper, title: "Private events & catering", description: "What you can accommodate — Relay checks this before assuming a request is possible." },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    icon: Users,
    sections: [
      { id: "policies", icon: Users, title: "Policies & common questions", description: "Answers to the questions customers ask most — the more Relay knows, the more it can answer directly." },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: Briefcase,
    sections: [
      { id: "hr", icon: Briefcase, title: "HR & employment", description: "How hiring works at your restaurant — so job-related emails are understood and never treated as customer opportunities." },
      { id: "vendors", icon: Truck, title: "Vendors", description: "Suppliers you already work with — Relay recognizes their emails and keeps vendor mail out of customer opportunities." },
      { id: "finance", icon: Wallet, title: "Finance & billing", description: "How invoices and payments are handled — trusted context Relay uses to interpret billing email." },
      { id: "operations", icon: Wrench, title: "Operations", description: "How the restaurant runs day to day — used carefully when an email touches equipment or urgent matters." },
      { id: "marketing", icon: Megaphone, title: "Marketing", description: "Promotions, social media, and brand context for marketing-related emails." },
    ],
  },
];

export default function RestaurantKnowledge() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [knowledge, setKnowledge] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState(null);
  const [group, setGroup] = useState("restaurant");

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
      toast({
        title: "Couldn't save your changes",
        description: "Please try again — your edits are still here.",
        variant: "destructive",
      });
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
  }, [dirty, knowledge, baseline]);

  if (loading || !knowledge) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const completion = profileCompletion(knowledge);
  const activeGroup = GROUPS.find((g) => g.id === group) || GROUPS[0];

  const renderSection = (s) => {
    const common = { id: s.id, icon: s.icon, title: s.title, description: s.description };
    switch (s.id) {
      case "basics":
        return (
          <KnowledgeSection {...common}>
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
              <SelectField
                label="Timezone (used for displayed timestamps)"
                value={knowledge.timezone}
                onChange={setField("timezone")}
                options={TIMEZONES}
              />
            </div>
          </KnowledgeSection>
        );
      case "hours":
        return (
          <KnowledgeSection {...common}>
            <HoursEditor value={knowledge} onChange={setKnowledge} />
          </KnowledgeSection>
        );
      case "offerings":
        return (
          <KnowledgeSection {...common}>
            <OfferingsEditor value={knowledge} onChange={setKnowledge} />
          </KnowledgeSection>
        );
      case "menu":
        return (
          <KnowledgeSection {...common}>
            <MenuPoliciesEditor value={knowledge} onChange={setKnowledge} part="menu" />
          </KnowledgeSection>
        );
      case "reservations":
        return (
          <KnowledgeSection {...common}>
            <ReservationsEditor value={knowledge} onChange={setKnowledge} />
          </KnowledgeSection>
        );
      case "events":
        return (
          <KnowledgeSection {...common}>
            <EventsCateringEditor value={knowledge} onChange={setKnowledge} />
          </KnowledgeSection>
        );
      case "policies":
        return (
          <KnowledgeSection {...common}>
            <MenuPoliciesEditor value={knowledge} onChange={setKnowledge} part="policies" />
          </KnowledgeSection>
        );
      case "hr":
        return (
          <KnowledgeSection {...common}>
            <HREditor value={knowledge} onChange={setKnowledge} />
          </KnowledgeSection>
        );
      case "vendors":
        return (
          <KnowledgeSection {...common}>
            <VendorsEditor value={knowledge} onChange={setKnowledge} />
          </KnowledgeSection>
        );
      case "finance":
        return (
          <KnowledgeSection {...common}>
            <FinanceEditor value={knowledge} onChange={setKnowledge} />
          </KnowledgeSection>
        );
      case "operations":
        return (
          <KnowledgeSection {...common}>
            <OperationsEditor value={knowledge} onChange={setKnowledge} />
          </KnowledgeSection>
        );
      case "marketing":
        return (
          <KnowledgeSection {...common}>
            <MarketingEditor value={knowledge} onChange={setKnowledge} />
          </KnowledgeSection>
        );
      default:
        return null;
    }
  };

  const SaveButton = (
    <Button onClick={handleSave} disabled={saving}>
      {saving ? (
        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
      ) : (
        <><Save className="w-4 h-4 mr-2" /> Save profile</>
      )}
    </Button>
  );
  const SavedBadge = saved && (
    <span className="text-sm text-emerald-600 flex items-center gap-1">
      <Check className="w-4 h-4" /> Saved
    </span>
  );

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto pb-20 md:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">Restaurant Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Teach Relay how your restaurant works — the verified facts it uses to understand every email.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {SaveButton}
          {SavedBadge}
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-4 mb-4">
        <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          Everything here is <span className="text-foreground font-medium">verified information you provide</span>.
          Relay uses it to understand communications and draft accurate responses — and it never invents
          facts you haven't entered. An incomplete profile works fine; each section just shows where more
          context would make Relay more useful.
        </p>
      </div>

      {/* Informational completeness — not a requirement, just orientation. */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {completion.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setGroup(c.id === "res_events" ? "res_events" : c.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              c.pct >= 100
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {c.pct >= 100 && <Check className="w-3.5 h-3.5" />}
            {c.label} {c.pct}%
          </button>
        ))}
      </div>

      {/* Group navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
        {GROUPS.map((g) => {
          const Icon = g.icon;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroup(g.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                group === g.id
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {g.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-5">
        {activeGroup.sections.map((s) => (
          <React.Fragment key={s.id}>{renderSection(s)}</React.Fragment>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-6">
        {SaveButton}
        {SavedBadge}
      </div>
    </div>
  );
}