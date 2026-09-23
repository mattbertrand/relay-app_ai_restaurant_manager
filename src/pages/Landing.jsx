import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { getRestaurantId } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, CheckCircle2, Clock, Mail, MessageSquare, Phone,
  TrendingUp, Users, Zap, Shield, Bell, Calendar, ChevronDown, Sparkles,
} from "lucide-react";

const FAQS = [
  { q: "How does Relay find opportunities?", a: "Relay monitors your customer communications — emails, website forms, and messages — and identifies inquiries that represent revenue opportunities, like catering requests, private events, and follow-ups. Everything is clearly labeled so you stay in control." },
  { q: "Do I need to connect my email right away?", a: "No. You can start exploring Relay with sample data immediately. When you're ready, you'll be able to connect Gmail, Outlook, and other channels. We'll guide you through each step." },
  { q: "Does Relay send messages on its own?", a: "Never without your approval. Relay prepares draft responses and recommends actions, but you review and approve everything before it's sent. You're always in control." },
  { q: "How much does Relay cost?", a: "We're finalizing simple, transparent pricing. During early access, Relay is free to use. Pricing will start at an accessible monthly rate for independent restaurants." },
  { q: "Is Relay built for independent restaurants?", a: "Yes. Relay is designed specifically for independent restaurants and small teams who don't have dedicated staff to manage customer communications full-time." },
];

const STEPS = [
  { icon: Mail, title: "Relay watches your channels", desc: "Customer inquiries from email, forms, and messages are collected in one place — so nothing gets lost in a busy inbox." },
  { icon: Sparkles, title: "Opportunities are surfaced", desc: "Relay identifies inquiries that represent real revenue — catering, events, follow-ups — and estimates their value." },
  { icon: CheckCircle2, title: "You review and act", desc: "Relay prepares a recommended response. You approve, edit, or dismiss. Everything is tracked so you can see what's been handled." },
];

const BENEFITS = [
  { icon: TrendingUp, title: "Capture more revenue", desc: "Every catering inquiry, private event, and follow-up gets tracked — so opportunities don't slip through the cracks." },
  { icon: Clock, title: "Save time every week", desc: "Stop digging through your inbox. Relay brings what needs attention to you, with context and next steps ready." },
  { icon: Shield, title: "Stay in control", desc: "Relay never sends anything without your approval. You review every action before it happens." },
  { icon: Bell, title: "Never miss a follow-up", desc: "Relay reminds you when a customer is waiting and tracks which opportunities still need a response." },
];

const EXAMPLES = [
  { type: "Catering inquiry", desc: "Customer is asking about catering for approximately 80 people.", value: "$1,500–$2,500", status: "Needs Review" },
  { type: "Private event inquiry", desc: "Customer wants to book the patio for a birthday celebration.", value: "$2,000–$3,000", status: "Needs Response" },
  { type: "Unanswered inquiry", desc: "Customer asked about patio availability 3 days ago — no response yet.", value: "$800–$1,500", status: "Needs Response" },
];

export default function Landing() {
  const { user, isAuthenticated, authChecked } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authChecked && isAuthenticated) {
      if (getRestaurantId(user)) {
        navigate("/today", { replace: true });
      } else {
        navigate("/onboarding", { replace: true });
      }
    }
  }, [authChecked, isAuthenticated, user, navigate]);

  if (authChecked && isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-heading font-bold text-sm">R</span>
            </div>
            <span className="font-heading text-xl font-semibold">Relay</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/register">Start Free</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 pt-20 pb-16 md:pt-28 md:pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent-foreground text-xs font-medium mb-6 border border-accent/20">
            <Sparkles className="w-3.5 h-3.5" />
            Early access for independent restaurants
          </div>
          <h1 className="font-heading text-4xl md:text-6xl font-semibold leading-[1.05] text-foreground max-w-3xl mx-auto">
            Never let another customer opportunity fall through the cracks.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">
            Relay keeps track of customer inquiries, follow-ups, and opportunities so your team can focus on running the restaurant.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/register">
                Start Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <a href="#how-it-works">See How It Works</a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">No credit card required · Set up in minutes</p>
        </div>
      </section>

      {/* Problem */}
      <section className="py-16 md:py-20 bg-secondary/40">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">The problem</p>
          <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground mb-6">
            Customers are reaching out. Most restaurants miss it.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Between dinner service, staff schedules, and the daily rush, customer messages pile up. A catering inquiry sits unanswered for days. A private event request gets buried. A loyal customer's follow-up is forgotten.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-4">
            These aren't just missed messages — they're missed revenue. And you usually never even know they were there.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">How Relay works</p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground">
              A calm, extra set of hands
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <step.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-xs font-semibold text-muted-foreground mb-2">Step {i + 1}</div>
                <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example opportunities */}
      <section className="py-16 md:py-20 bg-secondary/40">
        <div className="max-w-4xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Example opportunities</p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground">
              The kinds of things Relay catches
            </h2>
          </div>
          <div className="space-y-4">
            {EXAMPLES.map((ex, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">{ex.type}</span>
                    <span className="text-xs text-muted-foreground">{ex.status}</span>
                  </div>
                  <p className="text-sm text-foreground">{ex.desc}</p>
                </div>
                <div className="sm:text-right">
                  <div className="text-xs text-muted-foreground">Est. value</div>
                  <div className="font-heading text-lg font-semibold text-foreground">{ex.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Dashboard preview</p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground">
              Start each day knowing what needs attention
            </h2>
          </div>
          <div className="bg-card rounded-2xl border border-border shadow-lg p-6 md:p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Opportunities Found", value: "6", icon: TrendingUp },
                { label: "Follow-ups Needed", value: "3", icon: Bell },
                { label: "Est. Revenue", value: "$8.4K", icon: Zap },
                { label: "Actions Done", value: "2", icon: CheckCircle2 },
              ].map((s, i) => (
                <div key={i} className="bg-secondary/50 rounded-xl p-4">
                  <s.icon className="w-4 h-4 text-primary mb-2" />
                  <div className="text-xl font-heading font-semibold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div>
                  <div className="text-sm font-medium">Catering for ~80 people</div>
                  <div className="text-xs text-muted-foreground">Maria Chen · Catering inquiry</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">$1,500–$2,500</span>
                  <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Needs Review</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div>
                  <div className="text-sm font-medium">Private patio event for 40 guests</div>
                  <div className="text-xs text-muted-foreground">James Patterson · Private event</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">$2,000–$3,000</span>
                  <span className="text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">Needs Response</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 md:py-20 bg-secondary/40">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Benefits</p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground">
              Built for busy restaurant teams
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {BENEFITS.map((b, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-6">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <b.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Pricing</p>
          <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground mb-6">
            Simple pricing for independent restaurants
          </h2>
          <div className="bg-card rounded-2xl border border-border p-8 md:p-10 max-w-md mx-auto">
            <div className="text-sm text-muted-foreground mb-2">Early Access</div>
            <div className="font-heading text-5xl font-semibold text-foreground mb-2">Free</div>
            <p className="text-sm text-muted-foreground mb-6">During early access, Relay is completely free. Simple monthly pricing coming soon.</p>
            <Button asChild className="w-full" size="lg">
              <Link to="/register">Start Free</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-20 bg-secondary/40">
        <div className="max-w-3xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">FAQ</p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground">
              Questions, answered
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <details key={i} className="group bg-card rounded-xl border border-border p-5">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <span className="font-medium text-foreground">{faq.q}</span>
                  <ChevronDown className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform" />
                </summary>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <h2 className="font-heading text-3xl md:text-5xl font-semibold text-foreground mb-6 leading-tight">
            Customers are contacting your business.<br />Opportunities are being missed.
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Relay finds them and helps your team act on them.
          </p>
          <Button asChild size="lg">
            <Link to="/register">
              Start Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-heading font-bold text-xs">R</span>
            </div>
            <span className="font-heading text-lg font-semibold">Relay</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 Relay. Built for independent restaurants.</p>
        </div>
      </footer>
    </div>
  );
}