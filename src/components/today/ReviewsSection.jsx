import React from "react";
import { Link } from "react-router-dom";
import { Star, ArrowRight } from "lucide-react";

// New customer feedback, grouped by connected provider. Google is the only
// connected provider today — it always shows (a true zero state); future
// providers appear only when they actually have data. A review does not
// automatically require a response — "Needs response" counts only the ones
// Relay's classification says deserve the manager's attention.
export default function ReviewsSection({ reviews }) {
  const newReviews = (reviews && reviews.new) || 0;
  const providers = (reviews && reviews.providers) || [];
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          New Reviews <span className="text-muted-foreground font-normal">({newReviews})</span>
        </h2>
        <Link to="/reviews" className="text-sm text-primary hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="bg-card rounded-xl border border-border p-4 md:p-5 space-y-4">
        {providers.map((p) => (
          <div key={p.provider}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">{p.label}</p>
              <p className="text-xs text-muted-foreground">
                {p.new} new · {p.needs_response} needs response
              </p>
            </div>
            {p.new === 0 ? (
              <p className="text-xs text-muted-foreground mt-0.5">No new reviews</p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-1.5">
                {[5, 4, 3, 2, 1]
                  .filter((n) => p.distribution[n] > 0)
                  .map((n) => (
                    <span
                      key={n}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted border border-border rounded-full px-3 py-1"
                    >
                      <span className="text-amber-500 tracking-tight">{"★".repeat(n)}</span>
                      {p.distribution[n]}
                    </span>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}