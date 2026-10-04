import React from "react";
import { Link } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import { ArrowRight } from "lucide-react";

// Actively worked-on opportunities, straight from the existing lifecycle —
// never resolved ones, never duplicates.
export default function InProgressSection({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">Opportunities In Progress</h2>
        <Link to="/opportunities" className="text-sm text-primary hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="space-y-3">
        {items.map((o) => (
          <Link
            key={o.id}
            to={o.link}
            className="block bg-card rounded-xl border border-border p-4 hover:border-primary/30 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-foreground">{o.title}</h3>
                {o.customer && <p className="text-xs text-muted-foreground mt-0.5">{o.customer}</p>}
                {o.waiting && <p className="text-xs text-muted-foreground mt-1">{o.waiting}</p>}
              </div>
              <StatusBadge status="In Progress" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}