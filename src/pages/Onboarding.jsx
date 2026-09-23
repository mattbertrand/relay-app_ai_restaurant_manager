import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { getRestaurantId } from "@/lib/format";
import {
  generateDemoOpportunities, generateDemoConversations,
  generateDemoActions, generateDemoActivities,
} from "@/lib/demoData";
import { RESTAURANT_TYPES, EMPLOYEE_RANGES, INQUIRY_RANGES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowRight, Check } from "lucide-react";

export default function Onboarding() {
  const { user, isAuthenticated, authChecked } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    ownerName: "",
    email: "",
    phone: "",
    city: "",
    website: "",
    restaurant_type: "",
    employee_count: "",
    monthly_inquiries: "",
  });

  useEffect(() => {
    if (!authChecked) return;
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }
    if (getRestaurantId(user)) {
      navigate("/today", { replace: true });
    }
    if (user?.full_name) {
      setForm((f) => ({ ...f, ownerName: f.ownerName || user.full_name }));
    }
    if (user?.email) {
      setForm((f) => ({ ...f, email: f.email || user.email }));
    }
  }, [authChecked, isAuthenticated, user, navigate]);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const canProceed = () => {
    if (step === 0) return form.name.trim() && form.ownerName.trim();
    if (step === 1) return form.email.trim() && form.phone.trim() && form.city.trim();
    if (step === 2) return form.restaurant_type && form.employee_count && form.monthly_inquiries;
    return false;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // 1. Create the restaurant
      const restaurant = await base44.entities.Restaurant.create({
        name: form.name,
        owner_id: user.id,
        email: form.email,
        phone: form.phone,
        website: form.website,
        city: form.city,
        restaurant_type: form.restaurant_type,
        employee_count: form.employee_count,
        monthly_inquiries: form.monthly_inquiries,
        is_demo: true,
      });

      // 2. Link the restaurant to the user
      await base44.auth.updateMe({ restaurant_id: restaurant.id });

      // 3. Seed demo data
      const demoOpps = generateDemoOpportunities(restaurant.id);
      const createdOpps = await base44.entities.Opportunity.bulkCreate(demoOpps);
      const oppIds = createdOpps.map((o) => o.id);

      const demoConvos = generateDemoConversations(restaurant.id, oppIds);
      await base44.entities.Conversation.bulkCreate(demoConvos);

      const demoActions = generateDemoActions(restaurant.id, oppIds);
      await base44.entities.Action.bulkCreate(demoActions);

      const demoActivities = generateDemoActivities(restaurant.id);
      await base44.entities.Activity.bulkCreate(demoActivities);

      // 4. Hard redirect so auth context picks up the new restaurant_id
      window.location.href = "/today";
    } catch (err) {
      console.error(err);
      setLoading(false);
      alert("Something went wrong during setup. Please try again.");
    }
  };

  if (!authChecked || !isAuthenticated) return null;

  const steps = ["Restaurant", "Contact", "Details"];

  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary mb-4">
            <span className="text-primary-foreground font-heading font-bold text-lg">R</span>
          </div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Welcome to Relay</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Let's set up your restaurant. This takes about a minute.</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              <div className={`flex items-center gap-2 ${i <= step ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${
                  i < step ? "bg-primary text-primary-foreground border-primary" :
                  i === step ? "border-primary" : "border-border"
                }`}>
                  {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{s}</span>
              </div>
              {i < steps.length - 1 && <div className={`w-8 h-0.5 rounded ${i < step ? "bg-primary" : "bg-border"}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 md:p-8">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Restaurant name</Label>
                <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Oak & Vine" autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerName">Your name</Label>
                <Input id="ownerName" value={form.ownerName} onChange={(e) => update("ownerName", e.target.value)} placeholder="Owner or manager" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Restaurant email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="hello@yourrestaurant.com" autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Restaurant phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="(415) 555-0100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="San Francisco, CA" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="website" value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="yourrestaurant.com" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Restaurant type</Label>
                <Select value={form.restaurant_type} onValueChange={(v) => update("restaurant_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {RESTAURANT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Number of employees</Label>
                <Select value={form.employee_count} onValueChange={(v) => update("employee_count", v)}>
                  <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_RANGES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Approx. monthly customer inquiries</Label>
                <Select value={form.monthly_inquiries} onValueChange={(v) => update("monthly_inquiries", v)}>
                  <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                  <SelectContent>
                    {INQUIRY_RANGES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={loading} className="flex-1">
                Back
              </Button>
            )}
            {step < 2 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="flex-1">
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canProceed() || loading} className="flex-1">
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting up…</>
                ) : (
                  <>Finish setup <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          We'll add sample data so you can explore Relay right away.
        </p>
      </div>
    </div>
  );
}