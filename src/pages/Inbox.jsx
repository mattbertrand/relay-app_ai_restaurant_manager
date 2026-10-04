import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import DemoBanner from "@/components/DemoBanner";
import BackToToday from "@/components/BackToToday";
import EmptyState from "@/components/EmptyState";
import ConversationCard from "@/components/ConversationCard";
import { Button } from "@/components/ui/button";
import { conversationGroupKey, pickPrimaryConversation } from "@/lib/dedupe";
import CorrectionDialog from "@/components/CorrectionDialog";
import { Inbox as InboxIcon, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { htmlToPlainText } from "@/lib/draftText";

// Inbox message lifecycle — what happened with this email: New (needs
// attention), Reply recorded (responded in Relay), or Archived (out of the
// active inbox, never deleted). Separate from the opportunity lifecycle
// (New → In Progress → Resolved) on the Opportunities page.
const FILTERS = ["All", "New", "Reply recorded", "Archived"];
const SOURCES = [
  { label: "All", value: "all" },
  { label: "Demo data", value: "demo" },
  { label: "Live Gmail", value: "gmail" },
];
// The Inbox context (tab, source, scroll position) survives navigation, so
// returning from an opportunity puts the manager back where they were.
const INBOX_CONTEXT_KEY = "relay-inbox-context";

export default function Inbox() {
  const [conversations, setConversations] = useState(null);
  const [filter, setFilter] = useState("All");
  const [source, setSource] = useState("all");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  // Optional classification filter arriving from the Today dashboard
  // (e.g. "Attention" when the manager taps "Immediate Attention").
  const [analysisFilter, setAnalysisFilter] = useState(null);
  const [correcting, setCorrecting] = useState(null);
  const [replyBusy, setReplyBusy] = useState(false);
  const syncedRef = useRef(false);
  const location = useLocation();
  const scrollPosRef = useRef(0);
  const pendingScrollRef = useRef(null);
  const focusHandledRef = useRef(false);
  const focusId = location.state?.focusConversationId;

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

  // Restore the previous Inbox context (tab, source, scroll position) on
  // return — from an opportunity, the sidebar, or anywhere else. A "view
  // source email" jump focuses the exact message instead of restoring.
  useEffect(() => {
    if (location.state?.focusConversationId) {
      setFilter("All");
      setSource("all");
      return;
    }
    if (location.state?.analysisFilter) {
      setFilter("All");
      setSource("all");
      setAnalysisFilter(location.state.analysisFilter);
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(INBOX_CONTEXT_KEY) || "null");
      if (saved) {
        if (saved.filter) setFilter(saved.filter);
        if (saved.source) setSource(saved.source);
        pendingScrollRef.current = saved.scrollY || 0;
      }
    } catch (e) {
      /* fresh start */
    }
    // Mount-only: restore the saved context once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the scroll position live; the full context is saved on unmount.
  useEffect(() => {
    const onScroll = () => {
      scrollPosRef.current = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      try {
        sessionStorage.setItem(
          INBOX_CONTEXT_KEY,
          JSON.stringify({ filter, source, scrollY: scrollPosRef.current })
        );
      } catch (e) {
        /* storage unavailable */
      }
    };
  }, [filter, source]);

  // Once the list is rendered: focus the requested message, or restore the
  // previous scroll position.
  useEffect(() => {
    if (!conversations) return;
    if (focusId && !focusHandledRef.current) {
      const el = document.getElementById(`convo-${focusId}`);
      if (el) {
        focusHandledRef.current = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    if (pendingScrollRef.current) {
      window.scrollTo({ top: pendingScrollRef.current });
      pendingScrollRef.current = 0;
    }
  }, [conversations, focusId]);

  // Archive removes the message from the active inbox but never deletes it —
  // the conversation, draft, recorded response, and history all remain, and a
  // new customer reply brings it back to New.
  const archiveConversation = useCallback(async (convo) => {
    try {
      await base44.entities.Conversation.update(convo.id, { status: "Archived" });
      await base44.entities.Activity.create({
        restaurant_id: convo.restaurant_id,
        type: "archived",
        description: `Archived "${convo.subject}" from ${convo.customer_name}`,
        is_demo: !!convo.is_demo,
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  }, [loadData]);

  // Undo a mistaken archive or reply — the message returns to New with its
  // draft, response history, classification, and linked opportunity intact.
  const moveToNew = useCallback(async (convo) => {
    try {
      await base44.entities.Conversation.update(convo.id, { status: "New" });
      await base44.entities.Activity.create({
        restaurant_id: convo.restaurant_id,
        type: "moved_to_new",
        description: `Moved "${convo.subject}" back to New`,
        is_demo: !!convo.is_demo,
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  }, [loadData]);

  // Save an edited suggested reply without recording it yet. Once the manager
  // saves changes, the draft is manager-controlled content — later re-analysis
  // never silently overwrites it.
  const saveReplyDraft = useCallback(async (convo, text) => {
    await base44.entities.Conversation.update(convo.id, {
      draft_response: text,
      draft_edited: htmlToPlainText(text) !== (convo.relay_draft || ""),
    });
    if (htmlToPlainText(text) !== htmlToPlainText(convo.draft_response || "")) {
      await base44.entities.Activity.create({
        restaurant_id: convo.restaurant_id,
        type: "draft_edited",
        description: `Response draft edited for ${convo.customer_name} — "${convo.subject}"`,
        is_demo: !!convo.is_demo,
      });
    }
    loadData();
  }, [loadData]);

  // Record the manager's reply for an Attention message. The reply is stored
  // on the conversation and logged as activity — no email is sent.
  const markReplied = useCallback(async (convo, text) => {
    setReplyBusy(true);
    try {
      await base44.entities.Conversation.update(convo.id, {
        draft_response: text,
        draft_edited: htmlToPlainText(text) !== (convo.relay_draft || ""),
        reply_status: "Reply recorded",
        replied_at: new Date().toISOString(),
        status: "Reply recorded",
      });
      await base44.entities.Activity.create({
        restaurant_id: convo.restaurant_id,
        type: "reply_recorded",
        description: `Reply recorded for ${convo.customer_name} — "${convo.subject}"`,
        is_demo: !!convo.is_demo,
      });
      // The manager's actual response may commit to a follow-up ("I'll check
      // with the kitchen and get back to you") — detect it only from this
      // recorded reply, never from an unapproved draft. Best-effort: a
      // detection failure never blocks or breaks the reply recording.
      base44.functions
        .invoke("detectFollowUp", {
          conversation_id: convo.id,
          opportunity_id: convo.opportunity_id || "",
          reply_text: text,
          subject: convo.subject,
          customer_name: convo.customer_name,
        })
        .catch(() => {});
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setReplyBusy(false);
    }
  }, [loadData]);

  const filtered = (conversations || []).filter((c) => {
    const statusOk = filter === "All" || c.status === filter;
    // "Needs review" gathers messages Relay hasn't classified yet, including
    // ones whose analysis failed — they all need a human look.
    const analysisOk =
      !analysisFilter ||
      (analysisFilter === "Needs review"
        ? !c.analysis_status || c.analysis_status === "Not analyzed" || c.analysis_status === "Needs review"
        : c.analysis_status === analysisFilter);
    const sourceOk =
      source === "all" ||
      (source === "gmail" && c.source === "Gmail" && !c.is_demo) ||
      (source === "demo" && c.is_demo);
    return statusOk && analysisOk && sourceOk;
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
      <BackToToday label="Inbox" />
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

      {analysisFilter && (
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
            {analysisFilter}
            <button onClick={() => setAnalysisFilter(null)} className="hover:opacity-70" aria-label="Clear filter">
              ✕
            </button>
          </span>
        </div>
      )}

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
                <ConversationCard
                  convo={convo}
                  isLive={isLive(convo)}
                  highlighted={convo.id === focusId}
                  onArchive={archiveConversation}
                  onCorrect={setCorrecting}
                  onSaveReplyDraft={saveReplyDraft}
                  onMarkReplied={markReplied}
                  onMoveToNew={moveToNew}
                  replyBusy={replyBusy}
                  onReanalyzed={loadData}
                />
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
                      {similar.length} other message{similar.length === 1 ? "" : "s"} from this sender
                    </button>
                    {expandedGroups[convo.id] && (
                      <div className="mt-3 space-y-3 border-l-2 border-border pl-3 md:pl-4">
                        {similar.map((c) => (
                          <ConversationCard
                            key={c.id}
                            convo={c}
                            isLive={isLive(c)}
                            highlighted={c.id === focusId}
                            onArchive={archiveConversation}
                            onCorrect={setCorrecting}
                            onSaveReplyDraft={saveReplyDraft}
                            onMarkReplied={markReplied}
                            onMoveToNew={moveToNew}
                            replyBusy={replyBusy}
                            onReanalyzed={loadData}
                          />
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

      <CorrectionDialog
        open={!!correcting}
        onOpenChange={(o) => { if (!o) setCorrecting(null); }}
        convo={correcting}
        onDone={loadData}
      />
    </div>
  );
}