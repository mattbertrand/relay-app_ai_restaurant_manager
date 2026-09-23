import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import StatusBadge from "@/components/StatusBadge";
import DemoBanner from "@/components/DemoBanner";
import EmptyState from "@/components/EmptyState";
import { formatValueRange, timeAgo } from "@/lib/format";
import { Inbox as InboxIcon, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "New", "Needs Attention", "Responded", "Closed"];

export default function Inbox() {
  const [conversations, setConversations] = useState(null);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const convos = await base44.entities.Conversation.list("-created_date", 100);
      setConversations(convos);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = (conversations || []).filter((c) => filter === "All" || c.status === filter);
  const hasDemo = (conversations || []).some((c) => c.is_demo);

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">Inbox</h1>
        <p className="text-muted-foreground text-sm mt-1">Customer conversations from all your channels, in one place.</p>
      </div>

      {hasDemo && <div className="mb-6"><DemoBanner /></div>}

      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground hover:text-foreground border-border"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="No conversations here"
          description="When you connect your email and other channels, customer messages will appear here."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((convo) => (
            <div key={convo.id} className="bg-card rounded-xl border border-border p-4 md:p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground truncate block">{convo.customer_name}</span>
                      <span className="text-xs text-muted-foreground">{convo.source} · {timeAgo(convo.created_date)}</span>
                    </div>
                    <StatusBadge status={convo.status} />
                  </div>
                  <h3 className="text-sm font-medium text-foreground mt-2">{convo.subject}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{convo.message}</p>
                  {convo.opportunity_id && (
                    <Link
                      to={`/opportunities/${convo.opportunity_id}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2.5"
                    >
                      View related opportunity →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}