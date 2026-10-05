import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import HeaderSummary from "@/components/today/HeaderSummary";
import ScheduleSection from "@/components/today/ScheduleSection";
import NeedsActionSection from "@/components/today/NeedsActionSection";
import NewEmailsSection from "@/components/today/NewEmailsSection";
import ReviewsSection from "@/components/today/ReviewsSection";
import UpcomingSection from "@/components/today/UpcomingSection";
import { RefreshCw } from "lucide-react";

// Today — the manager's command center. In about a minute it answers:
// How busy am I? (header + schedule) · What needs me? (Needs Action) ·
// What just arrived? (New Emails, New Reviews) · What's coming up?
// All numbers and items come from the todayDashboard function's pass over
// the restaurant's actual Relay data — never invented.
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
      <div className="flex items-start justify-end mb-1">
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      <HeaderSummary name={data.manager_first_name} counts={data.counts} />

      <ScheduleSection schedule={data.schedule} onScheduleChanged={loadData} />
      <NewEmailsSection emails={data.emails} />
      <ReviewsSection reviews={data.reviews} />
      <UpcomingSection
        todayItems={data.today_items}
        upcomingItems={data.upcoming_items}
        upcomingAll={data.upcoming_all}
      />
      <NeedsActionSection items={data.need_action} count={data.counts.need_action} />
    </div>
  );
}