import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import DemoBanner from "@/components/DemoBanner";
import { Button } from "@/components/ui/button";
import WorkloadSummary from "@/components/today/WorkloadSummary";
import AttentionSection from "@/components/today/AttentionSection";
import FollowUpsSection from "@/components/today/FollowUpsSection";
import RevenueSection from "@/components/today/RevenueSection";
import NewEmailsSection from "@/components/today/NewEmailsSection";
import ReviewsSection from "@/components/today/ReviewsSection";
import InProgressSection from "@/components/today/InProgressSection";
import UpcomingSection from "@/components/today/UpcomingSection";
import { RefreshCw } from "lucide-react";

// Today — the manager's first screen: what's on the plate, what needs
// attention, what was promised, and where revenue may be won or lost.
// All numbers and items come from the todayDashboard function's pass over
// the restaurant's actual Relay data.
export default function Today() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const res = await base44.functions.invoke("todayDashboard", {});
      setData(res.data);
    } catch (err) {
      setError("Couldn't load today's overview. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-5 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">{error || "Nothing to show yet."}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => { setLoading(true); loadData(); }}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">
            Hi, {data.manager_first_name}.
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Here's what needs your attention today.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {data.has_demo && <div className="mb-6"><DemoBanner /></div>}

      <WorkloadSummary summary={data.summary} />
      <AttentionSection items={data.attention_items} />
      <FollowUpsSection items={data.follow_ups} />
      <RevenueSection items={data.revenue_opportunities} />
      <NewEmailsSection summary={data.summary} />
      <ReviewsSection reviews={data.reviews} />
      <InProgressSection items={data.in_progress} />
      <UpcomingSection
        todayItems={data.today_items}
        upcomingItems={data.upcoming_items}
        upcomingAll={data.upcoming_all}
      />
    </div>
  );
}