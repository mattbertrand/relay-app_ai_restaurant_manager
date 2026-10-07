import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import BackToToday from "@/components/BackToToday";
import EmptyState from "@/components/EmptyState";
import ConversationCard from "@/components/ConversationCard";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { conversationGroupKey, pickPrimaryConversation } from "@/lib/dedupe";
import CorrectionDialog from "@/components/CorrectionDialog";
import FollowUpPrompt from "@/components/FollowUpPrompt";
import { Link } from "react-router-dom";
import { Inbox as InboxIcon, RefreshCw, Loader2, ChevronDown, ChevronUp, Mail, Search, X, AlertTriangle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { htmlToPlainText } from "@/lib/draftText";
import { timeAgo } from "@/lib/format";
import {
  WORKFLOW_FILTERS,
  RESPONSE_FILTERS,
  effectiveWorkflow,
  effectiveResponse,
} from "@/lib/workflowStatus";

// Two separate concepts, shown separately:
// A. Workflow status — the underlying matter: New → In Progress → Resolved
//    (→ Archived), synced with the linked Opportunity.
// B. Response status — did the manager record a reply: Needs Response /
//    Response Recorded.
const SOURCES = [
  { label: "All", value: "all" },
  { label: "Live Gmail", value: "gmail" },
];
// The Inbox context (tab, source, scroll position) survives navigation, so
// returning from an opportunity puts the manager back where they were.
const INBOX_CONTEXT_KEY = "relay-inbox-context";

export default function Inbox() {
  const [conversations, setConversations] = useState(null);
  const [filter, setFilter] = useState("All"); // workflow status
  const [responseFilter, setResponseFilter] = useState("All responses");
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
  // Gmail connected but never initialized: the manager must explicitly choose
  // the initial import on the Communication page — nothing imports from here.
  const [needsSetup, setNeedsSetup] = useState(false);
  // Inbox lifecycle counts (All / New / Reply recorded / Archived) — real
  // numbers over every stored conversation, so they always reconcile.
  const [statusCounts, setStatusCounts] = useState(null);
  // The analysis queue state, separate from the Gmail import state.
  const [analysisCounts, setAnalysisCounts] = useState(null);
  const [retrying, setRetrying] = useState(false);
  // The lightweight follow-up prompt, shown once right after the manager
  // records a reply — never on viewing, filtering, or navigation.
  const [followUpConvo, setFollowUpConvo] = useState(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  // Email search — over the emails Relay has imported, including archived.
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const syncedRef = useRef(false);
  const location = useLocation();
  const scrollPosRef = useRef(0);
  const pendingScrollRef = useRef(null);
  const focusHandledRef = useRef(false);
  const [localFocusId, setLocalFocusId] = useState(null);
  const focusId = localFocusId || location.state?.focusConversationId;

  const loadAnalysisCounts = useCallback(async () => {
    try {
      // ONE grouped query instead of five separate count requests — analysis
      // progress must never flood the backend while a batch is running.
      const agg = await base44.entities.Conversation.aggregate({
        query: { source: "Gmail", is_demo: false },
        groupBy: "analysis_state",
      });
      const counts = { total: 0, pending: 0, processing: 0, analyzed: 0, failed: 0 };
      for (const row of agg.rows || []) {
        const key = row.analysis_state;
        if (key && key in counts) {
          counts[key] = row.count;
          counts.total += row.count;
        }
      }
      setAnalysisCounts(counts);
    } catch (err) {
      /* analysis counts are informational */
    }
  }, []);

  // Workflow counts over every stored conversation, plus how many have a
  // recorded response — real numbers, so filters always reconcile.
  const loadStatusCounts = useCallback(async () => {
    try {
      const [wfAgg, respAgg] = await Promise.all([
        base44.entities.Conversation.aggregate({ groupBy: "workflow_status" }),
        base44.entities.Conversation.aggregate({ groupBy: "status" }),
      ]);
      const wf = { All: 0 };
      for (const row of wfAgg.rows || []) {
        const key = row.workflow_status || "New";
        wf[key] = (wf[key] || 0) + row.count;
        wf.All += row.count;
      }
      let recorded = 0;
      for (const row of respAgg.rows || []) {
        if (row.status === "Reply recorded") recorded += row.count;
      }
      setStatusCounts({ workflow: wf, recorded });
    } catch (err) {
      /* counts are informational */
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const convos = await base44.entities.Conversation.list("-created_date", 100);
      setConversations(convos);
      loadStatusCounts();
      loadAnalysisCounts();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loadStatusCounts, loadAnalysisCounts]);

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
        } else if (data && data.initialized === false) {
          // Gmail is connected but the manager has never chosen an initial
          // import — Relay never imports anything from here. The manager
          // starts from the Communication page.
          setNeedsSetup(true);
          setLastSync(null);
        } else {
          setNeedsSetup(false);
          setLastSync({ summary: data });
          // Kick the analysis queue so pending messages start immediately.
          base44.functions.invoke("analyzeEmails", {}).catch(() => {});
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

  // Live progress without hammering the backend: the entity subscription
  // PUSHES every change (analysis claims, completions) — refreshes are
  // debounced and only happen when something actually changed, so there is no
  // fixed polling loop competing with the analysis itself.
  useEffect(() => {
    let timer = null;
    const refresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        base44.entities.Conversation.list("-created_date", 100)
          .then((convos) => setConversations(convos))
          .catch(() => {});
        loadAnalysisCounts();
      }, 1500);
    };
    const unsub = base44.entities.Conversation.subscribe(refresh);
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [loadAnalysisCounts]);

  // Slow fallback while messages are queued or being analyzed, in case a live
  // event is ever missed — one list page + one grouped query, twice a minute.
  useEffect(() => {
    if (!analysisCounts) return;
    if (analysisCounts.pending + analysisCounts.processing === 0) return;
    const timer = setInterval(() => {
      base44.entities.Conversation.list("-created_date", 100)
        .then((convos) => setConversations(convos))
        .catch(() => {});
      loadAnalysisCounts();
    }, 30000);
    return () => clearInterval(timer);
  }, [analysisCounts, loadAnalysisCounts]);

  // Restore the previous Inbox context (tab, source, scroll position) on
  // return — from an opportunity, the sidebar, or anywhere else. A "view
  // source email" jump focuses the exact message instead of restoring.
  useEffect(() => {
    if (location.state?.focusConversationId) {
      setFilter("All");
      setResponseFilter("All responses");
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
        if (saved.filter && WORKFLOW_FILTERS.includes(saved.filter)) setFilter(saved.filter);
        if (saved.responseFilter && RESPONSE_FILTERS.includes(saved.responseFilter)) {
          setResponseFilter(saved.responseFilter);
        }
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
          JSON.stringify({ filter, responseFilter, source, scrollY: scrollPosRef.current })
        );
      } catch (e) {
        /* storage unavailable */
      }
    };
  }, [filter, responseFilter, source]);

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
  // new customer reply brings it back to New. Gmail itself is never touched:
  // the message stays in the mailbox as the source of truth.
  const archiveConversation = useCallback(async (convo) => {
    try {
      await base44.entities.Conversation.update(convo.id, {
        status: "Archived",
        workflow_status: "Archived",
      });
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
      await base44.entities.Conversation.update(convo.id, {
        status: "New",
        // Undoing an archive returns the workflow to New too; otherwise the
        // workflow state is untouched (it belongs to the linked opportunity).
        workflow_status: convo.workflow_status === "Archived" ? "New" : convo.workflow_status || "New",
      });
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
      // Reply recorded — the manager's one-tap chance to commit to a
      // follow-up on this email (Skip dismisses it; Relay never re-asks).
      setFollowUpConvo(convo);
      setFollowUpOpen(true);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setReplyBusy(false);
    }
  }, [loadData]);

  // Retry messages whose analysis failed. Each message re-enters the queue
  // independently (the analysis worker picks it up one at a time) — retrying
  // never duplicates emails, opportunities, or history.
  const retryFailed = useCallback(async () => {
    const failed = (conversations || []).filter((c) => c.analysis_state === "failed");
    if (!failed.length) return;
    setRetrying(true);
    try {
      for (const convo of failed) {
        await base44.entities.Conversation.update(convo.id, {
          analysis_state: "pending",
          analysis_error: "",
        });
      }
      await loadAnalysisCounts();
    } catch (err) {
      console.error(err);
    } finally {
      setRetrying(false);
    }
  }, [conversations, loadAnalysisCounts]);

  // ---- Email search (imported emails only, archived included) ----
  const runSearch = useCallback(
    async (e) => {
      if (e) e.preventDefault();
      const q = searchQuery.trim();
      if (!q) return;
      setSearching(true);
      setSearchError(null);
      try {
        const res = await base44.functions.invoke("emailSearch", { query: q });
        setSearchResults(res.data.results || []);
      } catch (err) {
        setSearchError("Search failed. Please try again.");
        setSearchResults(null);
      } finally {
        setSearching(false);
      }
    },
    [searchQuery]
  );

  // Opening a search result uses the existing inbox card — never a duplicate
  // detail view. Archived or older messages are fetched into the list if they
  // aren't already on the loaded page.
  const openSearchResult = useCallback(
    async (result) => {
      setSearchResults(null);
      setSearchQuery("");
      setSearchError(null);
      setFilter("All");
      setAnalysisFilter(null);
      setLocalFocusId(result.id);
      const existing = (conversations || []).find((c) => c.id === result.id);
      if (!existing) {
        try {
          const convo = await base44.entities.Conversation.get(result.id);
          setConversations((prev) => [convo, ...(prev || [])]);
        } catch (err) {
          console.error(err);
        }
      }
    },
    [conversations]
  );

  const clearSearch = () => {
    setSearchResults(null);
    setSearchQuery("");
    setSearchError(null);
  };

  const filtered = (conversations || []).filter((c) => {
    // A. Workflow status — is this new, in progress, resolved, or archived?
    const workflowOk = filter === "All" || effectiveWorkflow(c) === filter;
    // B. Response status — did the manager record a reply?
    const responseOk =
      responseFilter === "All responses" || effectiveResponse(c) === responseFilter;
    // "Needs review" gathers messages Relay hasn't classified yet, including
    // ones whose analysis failed — they all need a human look.
    const analysisOk =
      !analysisFilter ||
      (analysisFilter === "Needs review"
        ? !c.analysis_status || c.analysis_status === "Not analyzed" || c.analysis_status === "Needs review"
        : c.analysis_status === analysisFilter);
    const sourceOk = source === "all" || (source === "gmail" && c.source === "Gmail" && !c.is_demo);
    return workflowOk && responseOk && analysisOk && sourceOk;
  });
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

  // ---- Gmail import status and email analysis status, kept separate. ----
  const importSummary = lastSync && lastSync.summary;
  const analysis = analysisCounts;
  const analysisActive = analysis && analysis.pending + analysis.processing > 0;
  const analysisDoneCount = analysis ? analysis.analyzed + analysis.failed : 0;

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
      <BackToToday label="Inbox" />
      {location.state?.backTo === "tasks" && (
        <div className="mb-3">
          <Link
            to="/tasks"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Follow-ups
          </Link>
        </div>
      )}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">Inbox</h1>
          <p className="text-muted-foreground text-sm mt-1">Customer conversations from all your channels, in one place.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => runSync(false)} disabled={syncing}>
          {syncing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Syncing…
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Sync Gmail
            </>
          )}
        </Button>
      </div>

      {/* Email search — over the emails Relay has imported, archived included */}
      <form onSubmit={runSearch} className="mb-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search your emails — e.g. "the email from Josh about Dine & Donate"'
              className="pl-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button type="submit" size="sm" disabled={searching || !searchQuery.trim()}>
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Search"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Searches the emails Relay has imported — including archived messages. Messages never imported into Relay
          can't be found here.
        </p>
      </form>

      {needsSetup && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Gmail connected — nothing imported yet</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Your Gmail account is connected, but Relay hasn't imported any messages yet. Go to Communication and choose
              Sync to select which emails Relay should import.
            </p>
            <Button size="sm" className="mt-3" asChild>
              <Link to="/settings?tab=Communication">Sync Emails</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Gmail import status */}
      {syncing && (
        <p className="text-xs text-muted-foreground mb-4">Checking Gmail for new messages…</p>
      )}
      {lastSync && lastSync.error && (
        <p className="text-xs text-amber-600 mb-4">{lastSync.error}</p>
      )}
      {importSummary && !syncing && (importSummary.newMessages || 0) === 0 && (
        <p className="text-xs text-muted-foreground mb-4">
          {importSummary.pendingAnalysis
            ? `Gmail synced — no new messages. ${importSummary.pendingAnalysis} message${importSummary.pendingAnalysis === 1 ? "" : "s"} queued for analysis.`
            : "No new Gmail messages."}
        </p>
      )}
      {importSummary && !syncing && (importSummary.newMessages || 0) > 0 && (
        <p className="text-xs text-muted-foreground mb-4">
          Gmail synced — imported {importSummary.newMessages} message
          {importSummary.newMessages === 1 ? "" : "s"}.
        </p>
      )}

      {/* Email analysis status — separate from the Gmail import above */}
      {analysis && analysis.total > 0 && (
        <div className="mb-4">
          {analysisActive ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Analyzing {analysisDoneCount} of {analysis.total} message{analysis.total === 1 ? "" : "s"}…
            </p>
          ) : analysis.failed > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-800">
                  {analysis.analyzed} of {analysis.total} message{analysis.total === 1 ? "" : "s"} analyzed ·{" "}
                  {analysis.failed} need{analysis.failed === 1 ? "s" : ""} attention
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Analysis didn't finish for {analysis.failed === 1 ? "one message" : "these messages"}. The rest were
                  unaffected.
                </p>
                <Button size="sm" variant="outline" className="mt-2 border-amber-300 text-amber-800 hover:bg-amber-100" onClick={retryFailed} disabled={retrying}>
                  {retrying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Retrying…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry failed message{analysis.failed === 1 ? "" : "s"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              All {analysis.total} message{analysis.total === 1 ? "" : "s"} analyzed.
            </p>
          )}
        </div>
      )}

      {/* Workflow status filters — is this new, in progress, resolved, archived? */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
        {WORKFLOW_FILTERS.map((f) => (
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
            {f} {statusCounts && statusCounts.workflow ? statusCounts.workflow[f] : ""}
          </button>
        ))}
      </div>

      {/* Response status — did the manager record a reply? Separate from the workflow above. */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
        {RESPONSE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setResponseFilter(f)}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border",
              responseFilter === f
                ? "bg-muted text-foreground border-border"
                : "bg-transparent text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            {f}
            {f === "Response Recorded" && statusCounts ? ` ${statusCounts.recorded}` : ""}
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

      {searching ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
        </div>
      ) : searchResults !== null ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              {searchResults.length === 0
                ? "No matching emails found."
                : `${searchResults.length} matching message${searchResults.length === 1 ? "" : "s"}`}
            </p>
            <Button variant="ghost" size="sm" onClick={clearSearch}>
              <X className="w-3.5 h-3.5 mr-1.5" /> Clear search
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-3">
              {searchResults.map((r) => (
                <div
                  key={r.id}
                  onClick={() => openSearchResult(r)}
                  className="bg-card rounded-xl border border-border p-4 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {r.sender}
                        {r.sender_email ? <span className="text-muted-foreground font-normal"> · {r.sender_email}</span> : null}
                      </p>
                      <h3 className="text-sm text-foreground mt-1 truncate">{r.subject}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.snippet}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {r.status && <StatusBadge status={r.status} />}
                        {r.analysis_status && r.analysis_status !== "Not analyzed" && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-stone-600 bg-stone-100 border border-stone-200">
                            {r.analysis_status}
                          </span>
                        )}
                        {r.opportunity_id && (
                          <Link
                            to={`/opportunities/${r.opportunity_id}`}
                            state={{ backTo: "inbox" }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] font-medium text-primary hover:underline"
                          >
                            Related opportunity: {r.opportunity_title || "view"} →
                          </Link>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {timeAgo(r.received_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="No conversations here"
          description={
            needsSetup
              ? "Your Gmail account is connected, but no messages have been imported yet. Choose Sync Emails above to import your first messages."
              : source === "gmail"
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

      <FollowUpPrompt
        open={followUpOpen}
        onOpenChange={(o) => { if (!o) setFollowUpOpen(false); }}
        source={
          followUpConvo
            ? {
                type: "email",
                id: followUpConvo.id,
                label: `Email — ${followUpConvo.customer_name}`,
                summary: `${followUpConvo.subject} — ${String(followUpConvo.message || "").slice(0, 300)}`,
                isDemo: !!followUpConvo.is_demo,
              }
            : null
        }
        headline="Reply recorded."
        question="Anything else you want to follow up on?"
      />
    </div>
  );
}