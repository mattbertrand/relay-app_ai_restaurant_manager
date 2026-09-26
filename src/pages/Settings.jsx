import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import GmailIntegrationCard from "@/components/GmailIntegrationCard";
import { getRestaurantId } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Store, Users, Bell, MessageSquare, ShieldCheck, User as UserIcon,
  Mail, Calendar, Phone, Globe, Instagram, Facebook, Save, Loader2, Check,
  BookOpen, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { setUnsavedChanges, clearUnsavedChanges } from "@/lib/unsavedChanges";

const TABS = [
  { label: "Restaurant", icon: Store },
  { label: "Team", icon: Users },
  { label: "Notifications", icon: Bell },
  { label: "Communication", icon: MessageSquare },
  { label: "Approvals", icon: ShieldCheck },
  { label: "Account", icon: UserIcon },
];

const INTEGRATIONS = [
  { name: "Outlook", icon: Mail, desc: "Connect your Outlook inbox" },
  { name: "Website forms", icon: Globe, desc: "Capture inquiries from your website" },
  { name: "SMS", icon: MessageSquare, desc: "Receive and respond to text messages" },
  { name: "Reservation platforms", icon: Calendar, desc: "Connect OpenTable, Resy, and more" },
  { name: "Google Business Profile", icon: Globe, desc: "Monitor Google messages and reviews" },
  { name: "Instagram", icon: Instagram, desc: "Track DMs and inquiries" },
  { name: "Facebook", icon: Facebook, desc: "Monitor Messenger and page messages" },
];

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("Restaurant");
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({});
  const [baseline, setBaseline] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const rid = getRestaurantId(user);
      if (!rid) return;
      const r = await base44.entities.Restaurant.get(rid);
      setRestaurant(r);
      setForm({
        name: r.name || "",
        email: r.email || "",
        phone: r.phone || "",
        website: r.website || "",
        city: r.city || "",
        restaurant_type: r.restaurant_type || "",
      });
      setBaseline(JSON.stringify({
        name: r.name || "",
        email: r.email || "",
        phone: r.phone || "",
        website: r.website || "",
        city: r.city || "",
        restaurant_type: r.restaurant_type || "",
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    if (saving) return false;
    setSaving(true);
    try {
      await base44.entities.Restaurant.update(restaurant.id, form);
      setBaseline(JSON.stringify(form));
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

  const dirty = !!restaurant && !!baseline && JSON.stringify(form) !== baseline;

  // Block navigation away while there are unsaved edits — the shared guard
  // offers to save them first.
  useEffect(() => {
    if (!dirty) return;
    setUnsavedChanges({
      isDirty: () => JSON.stringify(form) !== baseline,
      save: async () => {
        const ok = await handleSave();
        if (!ok) throw new Error("Save failed");
      },
    });
    return () => clearUnsavedChanges();
  });

  const handleLogout = () => {
    logout(false);
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto pb-20 md:pb-8">
      <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => setTab(t.label)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              tab === t.label ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "Restaurant" && (
        <div className="space-y-5">
        <div className="bg-card rounded-xl border border-primary/20 p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-heading text-lg font-semibold text-foreground mb-1">Restaurant Knowledge</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Teach Relay your hours, reservation rules, event capacity, catering options, menu, and
                policies. Relay uses only what you enter here — it never invents facts.
              </p>
              <Link
                to="/knowledge"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline mt-3"
              >
                Manage restaurant knowledge <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-1">Restaurant Information</h2>
          <p className="text-sm text-muted-foreground mb-5">Keep your restaurant details up to date.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Restaurant name</Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.website || ""} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Restaurant type</Label>
              <Input value={form.restaurant_type || ""} onChange={(e) => setForm({ ...form, restaurant_type: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-6">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : <><Save className="w-4 h-4 mr-2" /> Save changes</>}
            </Button>
            {saved && <span className="text-sm text-emerald-600 flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
          </div>
        </div>
        </div>
      )}

      {tab === "Team" && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-1">Team Members</h2>
          <p className="text-sm text-muted-foreground mb-5">Invite your team to help manage customer opportunities.</p>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 mb-4">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
              {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{user?.full_name || "You"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">Owner</span>
          </div>
          <div className="text-center py-8 border border-dashed border-border rounded-lg">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Team invitations coming soon.</p>
          </div>
        </div>
      )}

      {tab === "Notifications" && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-1">Notifications</h2>
          <p className="text-sm text-muted-foreground mb-5">Choose what Relay brings to your attention.</p>
          <div className="space-y-1">
            {[
              { label: "New opportunities", desc: "Get notified when a new opportunity is identified", defaultOn: true },
              { label: "Unanswered inquiries", desc: "Alert when a customer hasn't received a response", defaultOn: true },
              { label: "Follow-up reminders", desc: "Reminders for pending follow-ups", defaultOn: true },
              { label: "Daily summary", desc: "A daily digest of what needs attention", defaultOn: false },
            ].map((n, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{n.label}</p>
                  <p className="text-xs text-muted-foreground">{n.desc}</p>
                </div>
                <Switch defaultChecked={n.defaultOn} />
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">Email notifications are sent to {user?.email}.</p>
        </div>
      )}

      {tab === "Communication" && (
        <div>
          <div className="mb-5">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-1">Communication Preferences</h2>
            <p className="text-sm text-muted-foreground">Control how Relay communicates with your customers.</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-6 mb-5">
            <div className="space-y-1">
              {[
                { label: "Email", desc: "Send responses via email", defaultOn: true },
                { label: "SMS", desc: "Send responses via text message", defaultOn: false },
                { label: "Response tone", desc: "Use a warm, professional tone in drafts", defaultOn: true },
              ].map((n, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{n.label}</p>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </div>
                  <Switch defaultChecked={n.defaultOn} />
                </div>
              ))}
            </div>
          </div>

          <h3 className="font-heading text-base font-semibold text-foreground mb-3">Integrations</h3>
          <p className="text-sm text-muted-foreground mb-4">Connect your channels to start collecting real customer inquiries.</p>
          <div className="mb-4">
            <GmailIntegrationCard />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {INTEGRATIONS.map((int) => (
              <div key={int.name} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <int.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{int.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{int.desc}</p>
                </div>
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 whitespace-nowrap">Coming Soon</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "Approvals" && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-1">Approval Preferences</h2>
          <p className="text-sm text-muted-foreground mb-5">Control what Relay can do on its own and what needs your approval.</p>
          <div className="space-y-1">
            {[
              { label: "Require approval for all responses", desc: "Relay prepares drafts but never sends without your review", defaultOn: true },
              { label: "Require approval for follow-ups", desc: "Follow-up reminders need your confirmation before sending", defaultOn: true },
              { label: "Auto-dismiss stale opportunities", desc: "Automatically dismiss opportunities inactive for 30 days", defaultOn: false },
            ].map((n, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{n.label}</p>
                  <p className="text-xs text-muted-foreground">{n.desc}</p>
                </div>
                <Switch defaultChecked={n.defaultOn} />
              </div>
            ))}
          </div>
          <div className="mt-5 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-foreground">
              <ShieldCheck className="w-4 h-4 inline mr-1.5 text-primary" />
              Relay never sends messages or performs actions without your approval. This is a core principle of the product.
            </p>
          </div>
        </div>
      )}

      {tab === "Account" && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-1">Account</h2>
          <p className="text-sm text-muted-foreground mb-5">Manage your account and sign-in details.</p>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <p className="text-sm font-medium text-foreground mt-0.5">{user?.full_name || "Not set"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="text-sm font-medium text-foreground mt-0.5">{user?.email}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Role</Label>
              <p className="text-sm font-medium text-foreground mt-0.5 capitalize">{user?.role || "user"}</p>
            </div>
          </div>
          <Separator className="my-5" />
          <Button variant="outline" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      )}
    </div>
  );
}