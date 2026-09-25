import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import DemoBanner from "@/components/DemoBanner";
import EmptyState from "@/components/EmptyState";
import ConversationCard from "@/components/ConversationCard";
import { Button } from "@/components/ui/button";
import { conversationGroupKey, pickPrimaryConversation } from "@/lib/dedupe";
import { Inbox as InboxIcon, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
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
  const [expandedGroups, setExpandedGroups] = useState({});
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

  // Group near-duplicate live messages (same sender, same subject) so they read
  // as one conversation instead of a wall of repeated cards
  const liveGroups = {};
  for (const c of filtered) {
    if (!isLive(c)) continue;
    const key = conversationGroupKey(c);
    if (!key) continue;
    (liveGroups[key] ||= []).push(c);
  }
  const similarByPrimaryId = new Map();
  const hiddenSimilarIds = new Set();
  for (const members of Object.values(liveGroups)) {
    if (members.length < 2) continue;
    const primary = pickPrimaryConversation(members);
    const similar = members.filter((m) => m.id !== primary.id);
    similarByPrimaryId.set(primary.id, similar);
    similar.forEach((m) => hiddenSimilarIds.add(m.id));
  }
  const toggleGroup = (id) =>
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));

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
          {filtered.map((convo) => {
            if (hiddenSimilarIds.has(convo.id)) return null;
            const similar = similarByPrimaryId.get(convo.id) || [];
            return (
              <div key={convo.id}>
                <ConversationCard convo={convo} isLive={isLive(convo)} />
                {similar.length > 0 && (
                  <div className="pl-2 md:pl-4">
                    <button
                      onClick={() => toggleGroup(convo.id)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-3"
                    >
                      {expandedGroups[convo.id] ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      {similar.length} similar message{similar.length === 1 ? "" : "s"} from this sender
                    </button>
                    {expandedGroups[convo.id] && (
                      <div className="mt-3 space-y-3 border-l-2 border-border pl-3 md:pl-4">
                        {similar.map((c) => (
                          <ConversationCard key={c.id} convo={c} isLive={isLive(c)} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}