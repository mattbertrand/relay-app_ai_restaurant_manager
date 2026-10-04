import React from "react";
import { Link } from "react-router-dom";
import { Star, ArrowRight } from "lucide-react";

// The review summary: how many new reviews arrived, the star distribution,
// and how many currently need attention — from the actual review sources.
export default function ReviewsSection({ reviews }) {
  if (!reviews || reviews.new === 0) return null;
  const stars = [5, 4, 3, 2, 1].filter((n) => reviews.distribution[n] > 0);
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">New Reviews</h2>
        <Link to="/reviews" className="text-sm text-primary hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="bg-card rounded-xl border border-border p-4 md:p-5">
        <p className="text-sm font-medium text-foreground mb-3">
          {reviews.new} new review{reviews.new === 1 ? "" : "s"}
        </p>
        <div className="space-y-1.5 mb-3">
          {stars.map((n) => (
            <div key={n} className="flex items-center gap-2 text-xs">
              <span className="w-16 text-amber-500 tracking-tight">{"★".repeat(n)}</span>
              <span className="text-muted-foreground">{reviews.distribution[n]}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Needs Response: <span className="font-semibold text-foreground">{reviews.needs_response}</span>
        </p>
      </div>
    </section>
  );
}