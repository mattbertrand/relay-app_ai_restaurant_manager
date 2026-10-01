import React from "react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { RefreshCw, Clock, Info, Star, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABEL = { not_connected: "Not connected", connected: "Connected", error: "Error" };

export default function ReviewSourceCard({ meta, source, onAction, busy, note, reviewCount }) {
  const comingSoon = meta.status !== "available";
  const connected = source && source.connection_status === "connected";
  return (
    <div className={cn("bg-card rounded-xl border border-border p-5", comingSoon && "opacity-60")}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
            {meta.isDemo ? <Star className="w-4 h-4 text-muted-foreground" /> : <Link2 className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </div>
        </div>
        {comingSoon ? (
          <span className="text-xs font-medium text-muted-foreground border border-border rounded-full px-2.5 py-0.5 whitespace-nowrap">
            Coming soon
          </span>
        ) : (
          <StatusBadge status={STATUS_LABEL[source ? source.connection_status : "not_connected"]} />
        )}
      </div>

      {comingSoon ? (
        <p className="text-xs text-muted-foreground mt-3">This provider will appear here once it is supported.</p>
      ) : (
        <>
          {source && connected && (
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {source.provider_location_name && (
                <p>
                  Location: <span className="text-foreground">{source.provider_location_name}</span>
                </p>
              )}
              <p className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Last synced:{" "}
                {source.last_successful_sync ? formatDateTime(source.last_successful_sync) : "never"}
              </p>
              {typeof reviewCount === "number" && <p>Reviews monitored: {reviewCount}</p>}
              {source.error_message && <p className="text-destructive">{source.error_message}</p>}
            </div>
          )}
          {source && !connected && source.error_message && (
            <p className="text-xs text-destructive mt-3 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {source.error_message}
            </p>
          )}
          {note && !source && (
            <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {note}
            </p>
          )}
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={onAction} disabled={busy}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              {source && connected ? (meta.isDemo ? "Sync demo reviews" : "Sync now") : meta.isDemo ? "Load demo reviews" : "Connect Google"}
            </Button>
            {source && connected && !meta.isDemo && (
              <Button size="sm" variant="outline" onClick={onAction} disabled={busy}>
                Manage connection
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}