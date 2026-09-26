import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, RefreshCw, RefreshCcw, XCircle, FlaskConical, Check } from "lucide-react";

const GMAIL_CONNECTOR_ID = "6ab4c39dd81d1c8bc44d5db3";

function errorDetail(err) {
  const body = err?.response?.data ?? err?.data;
  const detail =
    typeof body === "string" ? body : body?.error || body?.message || body?.detail;
  return detail || err?.message || "Unknown error";
}

function summaryText(summary) {
  if (!summary) return "";
  const parts = [];
  const newMessages = summary.newMessages || 0;
  parts.push(`${newMessages} new message${newMessages === 1 ? "" : "s"}`);
  if (summary.analyzed) parts.push(`${summary.analyzed} analyzed`);
  if (summary.opportunitiesCreated) {
    parts.push(
      `${summary.opportunitiesCreated} opportunit${summary.opportunitiesCreated === 1 ? "y" : "ies"} identified`
    );
  }
  if (summary.duplicatesMerged) {
    parts.push(`${summary.duplicatesMerged} duplicate${summary.duplicatesMerged === 1 ? "" : "s"} merged`);
  }
  if (summary.followupsLinked) {
    parts.push(`${summary.followupsLinked} follow-up${summary.followupsLinked === 1 ? "" : "s"} linked to existing`);
  }
  if (summary.reopened) {
    parts.push(`${summary.reopened} reopened`);
  }
  if (summary.needsReview) parts.push(`${summary.needsReview} need review`);
  return parts.join(" · ") + ".";
}

function reprocessText(summary) {
  if (!summary) return "";
  const parts = [];
  const n = summary.reprocessed || 0;
  if (n) parts.push(`${n} conversation${n === 1 ? "" : "s"} re-analyzed`);
  if (summary.opportunitiesCreated) {
    parts.push(
      `${summary.opportunitiesCreated} new opportunit${summary.opportunitiesCreated === 1 ? "y" : "ies"}`
    );
  }
  if (summary.opportunitiesUpdated) parts.push(`${summary.opportunitiesUpdated} updated`);
  if (summary.attentionFlagged) parts.push(`${summary.attentionFlagged} flagged for attention`);
  if (summary.opportunitiesRemoved) {
    parts.push(
      `${summary.opportunitiesRemoved} outdated draft${summary.opportunitiesRemoved === 1 ? "" : "s"} removed`
    );
  }
  if (summary.followupsLinked) {
    parts.push(`${summary.followupsLinked} follow-up${summary.followupsLinked === 1 ? "" : "s"} linked to existing`);
  }
  if (summary.reopened) {
    parts.push(`${summary.reopened} reopened`);
  }
  if (summary.needsReview) parts.push(`${summary.needsReview} need review`);
  return parts.length ? parts.join(" · ") + "." : "No conversations to re-analyze.";
}

export default function GmailIntegrationCard() {
  const [status, setStatus] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeSummary, setReanalyzeSummary] = useState(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("gmailStatus", {});
      setStatus(res.data);
      return res.data;
    } catch (err) {
      setStatus({ connected: false });
      return { connected: false };
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const runSync = async () => {
    setSyncing(true);
    setSyncSummary(null);
    try {
      const res = await base44.functions.invoke("gmailSync", {});
      setSyncSummary(res.data);
    } catch (err) {
      setSyncSummary({ error: `Gmail sync failed: ${errorDetail(err)}` });
    } finally {
      setSyncing(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setSyncSummary(null);
    try {
      const url = await base44.connectors.connectAppUser(GMAIL_CONNECTOR_ID);
      const popup = window.open(url, "_blank");
      const timer = setInterval(async () => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          const next = await checkStatus();
          if (next && next.connected) {
            runSync();
          }
        }
      }, 500);
    } catch (err) {
      setStatus({ connected: false, error: "Gmail connection failed. Please try again." });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await base44.connectors.disconnectAppUser(GMAIL_CONNECTOR_ID);
    } finally {
      setConfirmDisconnect(false);
      setStatus({ connected: false });
      setSyncSummary(null);
    }
  };

  const runReanalyze = async () => {
    setReanalyzing(true);
    setReanalyzeSummary(null);
    try {
      const res = await base44.functions.invoke("gmailReprocess", {});
      setReanalyzeSummary(res.data);
    } catch (err) {
      setReanalyzeSummary({ error: `Re-analysis failed: ${errorDetail(err)}` });
    } finally {
      setReanalyzing(false);
    }
  };

  const runTests = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const res = await base44.functions.invoke("testGmailAnalysis", {});
      setTestResults(res.data);
    } catch (err) {
      setTestResults({ error: "Test run failed. Please try again." });
    } finally {
      setTesting(false);
    }
  };

  const connected = status?.connected;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">Gmail</p>
            {connected ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Gmail connected
              </span>
            ) : status ? (
              <span className="text-xs text-muted-foreground">Not connected</span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {connected
              ? `Connected${status.email ? ` as ${status.email}` : ""}. Incoming customer emails are imported into your Inbox and reviewed for opportunities. Nothing is ever sent to customers without your approval.`
              : "Connect your restaurant's Gmail inbox to receive customer emails in Relay. Emails from the last 30 days are imported. Nothing is ever sent to customers without your approval."}
          </p>

          {connected && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Button size="sm" variant="outline" onClick={runSync} disabled={syncing}>
                {syncing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Analyzing incoming messages…
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Sync now
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={runReanalyze}
                disabled={reanalyzing || syncing}
              >
                {reanalyzing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Re-analyzing…
                  </>
                ) : (
                  <>
                    <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Re-analyze inbox
                  </>
                )}
              </Button>
              {!confirmDisconnect ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDisconnect(true)}
                  className="text-muted-foreground"
                >
                  Disconnect Gmail
                </Button>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Disconnect Gmail?</span>
                  <Button size="sm" variant="destructive" onClick={handleDisconnect}>
                    Yes, disconnect
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDisconnect(false)}>
                    Cancel
                  </Button>
                </span>
              )}
            </div>
          )}

          {syncSummary && syncSummary.error && (
            <p className="text-xs text-destructive mt-2">{syncSummary.error}</p>
          )}
          {syncSummary && !syncSummary.error && syncSummary.connected === false && (
            <p className="text-xs text-amber-600 mt-2">Gmail is not connected. Reconnect to resume syncing.</p>
          )}
          {syncSummary && !syncSummary.error && syncSummary.connected !== false && (
            <p className="text-xs text-muted-foreground mt-2">{summaryText(syncSummary)}</p>
          )}
          {reanalyzeSummary && reanalyzeSummary.error && (
            <p className="text-xs text-destructive mt-2">{reanalyzeSummary.error}</p>
          )}
          {reanalyzeSummary && !reanalyzeSummary.error && reanalyzeSummary.connected === false && (
            <p className="text-xs text-amber-600 mt-2">
              Gmail is not connected. Reconnect to re-analyze your inbox.
            </p>
          )}
          {reanalyzeSummary && !reanalyzeSummary.error && reanalyzeSummary.connected !== false && (
            <p className="text-xs text-muted-foreground mt-2">{reprocessText(reanalyzeSummary)}</p>
          )}

          {!connected && (
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={handleConnect} disabled={connecting}>
                {connecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Waiting for authorization…
                  </>
                ) : (
                  "Connect Gmail"
                )}
              </Button>
            </div>
          )}
          {status && !connected && status.error && (
            <p className="text-xs text-destructive mt-2">{status.error}</p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Check the email analysis with sample scenarios — no Gmail connection needed.
          </p>
          <Button size="sm" variant="outline" onClick={runTests} disabled={testing}>
            {testing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Running tests…
              </>
            ) : (
              <>
                <FlaskConical className="w-3.5 h-3.5 mr-1.5" /> Run test scenarios
              </>
            )}
          </Button>
        </div>
        {testResults && !testResults.error && (
          <div className="mt-3 space-y-1.5">
            {testResults.results.map((r) => (
              <div key={r.scenario} className="flex items-start justify-between gap-3 text-xs">
                <span className="text-foreground flex items-center gap-1.5 min-w-0">
                  {r.pass ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  )}
                  <span className="truncate">
                    {r.scenario}
                    {(r.actualClassification || r.actualCategory) && (
                      <span className="text-muted-foreground">
                        {" — "}
                        {[r.actualClassification, r.actualCategory && r.actualCategory.replace(/_/g, " ")]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </span>
                </span>
                {r.hasValueEstimate && r.valueConfidence && (
                  <span className="text-muted-foreground whitespace-nowrap">{r.valueConfidence} confidence</span>
                )}
              </div>
            ))}
          </div>
        )}
        {testResults && testResults.error && (
          <p className="text-xs text-destructive mt-2">{testResults.error}</p>
        )}
      </div>
    </div>
  );
}