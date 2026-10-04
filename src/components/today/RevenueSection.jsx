import React from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";

// Situations where Relay has a real basis for potential revenue — never
// invented dollar values; only what the inquiry actually contains.
export default function RevenueSection({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Revenue Opportunities</h2>
      <div className="space-y-3">
        {items.map((o) => (
          <Link
            key={o.id}
            to={o.link}
            className="block bg-card rounded-xl border border-emerald-200 p-4 hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold tracking-wide text-emerald-700">{(o.type || "").toUpperCase()}</p>
                <h3 className="text-sm font-medium text-foreground mt-0.5">{o.title}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {o.guests && (
                    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      {o.guests}
                    </span>
                  )}
                  <span className="text-[11px] font-medium text-muted-foreground">Potential revenue opportunity</span>
                </div>
                {o.note && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{o.note}</p>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}