import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import StatusBadge from "@/components/StatusBadge";
import DemoBanner from "@/components/DemoBanner";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import { Inbox as InboxIcon, Mail, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "New", "Needs Attention", "Opportunity", "Reviewed", "Closed"];
const SOURCES = [
  { label: "All", value: "all" },
  { label: "Demo data", value: "demo" },
  { label: "Live Gmail", value: "gmail" },
];

export default function Inbox() {
  const [conversations, setConversations] = useState(null);
  const [filter, setFilter] = useState("All");
  const [source, setSource] = useState("all");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const syncedRef = useRef(false);

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

  const runSync = useCallback(
    async (silent) => {
      setSyncing(true);
      try {
        const res = await base44.functions.invoke("gmailSync", {});
        const data = res.data;
        if (data && data.connected === false) {
          if (!silent) {
            setLastSync({ error: "Gmail is not connected. Connect Gmail in Settings → Communication." });
          }
        } else {
          setLastSync({ summary: data });
          loadData();
        }
      } catch (err) {
        if (!silent) setLastSync({ error: "Gmail sync failed. Please try again." });
      } finally {
        setSyncing(false);
      }
    },
    [loadData]
  );

  useEffect(() => {
    loadData();
    // Pull new Gmail messages once when the Inbox opens (silent — no error if Gmail isn't connected)
    if (!syncedRef.current) {
      syncedRef.current = true;
      runSync(true);
    }
  }, [loadData, runSync]);

  const filtered = (conversations || []).filter((c) => {
    const statusOk = filter === "All" || c.status === filter;
    const sourceOk =
      source === "all" ||
      (source === "gmail" && c.source === "Gmail" && !c.is_demo) ||
      (source === "demo" && c.is_demo);
    return statusOk && sourceOk;
  });
  const hasDemo = (conversations || []).some((c) => c.is_demo);
  const isLive = (c) => c.source === "Gmail" && !c.is_demo;

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">Inbox</h1>
          <p className="text-muted-foreground text-sm mt-1">Customer conversations from all your channels, in one place.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => runSync(false)} disabled={syncing}>
          {syncing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Analyzing…
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Sync Gmail
            </>
          )}
        </Button>
      </div>

      {hasDemo && source !== "gmail" && <div className="mb-6"><DemoBanner /></div>}

      {syncing && (
        <p className="text-xs text-muted-foreground mb-4">Checking Gmail for new messages…</p>
      )}
      {lastSync && lastSync.error && (
        <p className="text-xs text-amber-600 mb-4">{lastSync.error}</p>
      )}
      {lastSync && lastSync.summary && !syncing && (lastSync.summary.newMessages || 0) === 0 && (
        <p className="text-xs text-muted-foreground mb-4">No new Gmail messages.</p>
      )}
      {lastSync && lastSync.summary && !syncing && (lastSync.summary.newMessages || 0) > 0 && (
        <p className="text-xs text-muted-foreground mb-4">
          Imported {lastSync.summary.newMessages} message
          {lastSync.summary.newMessages === 1 ? "" : "s"}
          {lastSync.summary.opportunitiesCreated
            ? ` · ${lastSync.summary.opportunitiesCreated} opportunit${lastSync.summary.opportunitiesCreated === 1 ? "y" : "ies"} identified`
            : ""}
          {lastSync.summary.needsReview ? ` · ${lastSync.summary.needsReview} need review` : ""}
          .
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
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

      <div className="flex gap-2 mb-5 -mx-1 px-1">
        {SOURCES.map((s) => (
          <button
            key={s.value}
            onClick={() => setSource(s.value)}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-medium transition-colors border",
              source === s.value
                ? "bg-muted text-foreground border-border"
                : "bg-transparent text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            {s.label}
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
          description={
            source === "gmail"
              ? "Connect Gmail and sync — your live customer emails will appear here."
              : "When you connect your email and other channels, customer messages will appear here."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((convo) => (
            <div key={convo.id} className="bg-card rounded-xl border border-border p-4 md:p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground truncate block">{convo.customer_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {convo.source} · {timeAgo(convo.received_at || convo.created_date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isLive(convo) ? (
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          Live Gmail
                        </span>
                      ) : convo.is_demo ? (
                        <span className="text-[10px] font-medium text-stone-500 bg-stone-50 border border-stone-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          Demo data
                        </span>
                      ) : null}
                      <StatusBadge status={convo.status} />
                    </div>
                  </div>
                  {isLive(convo) && convo.customer_email && (
                    <p className="text-xs text-muted-foreground">{convo.customer_email}</p>
                  )}
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