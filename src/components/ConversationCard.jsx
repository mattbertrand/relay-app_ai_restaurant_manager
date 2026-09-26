import React from "react";
import { Link } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Mail, Check, Archive, AlertCircle } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { categoryLabel } from "@/lib/classification";

// One inbox conversation. The Inbox lifecycle (New → Reviewed → Archived) is
// the state of the message itself — separate from the related opportunity's
// New → In Progress → Resolved lifecycle.
export default function ConversationCard({ convo, isLive, onReview, onArchive, onCorrect }) {
  const showActions = isLive && convo.status !== "Archived";

  return (
    <div className="bg-card rounded-xl border border-border p-4 md:p-5">
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
              {isLive ? (
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
          {isLive && convo.customer_email && (
            <p className="text-xs text-muted-foreground">{convo.customer_email}</p>
          )}
          <h3 className="text-sm font-medium text-foreground mt-2">{convo.subject}</h3>
          {isLive && convo.category && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {categoryLabel(convo.category)}
              {convo.intent ? ` · ${convo.intent}` : ""}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{convo.message}</p>
          {convo.opportunity_id && (
            <Link
              to={`/opportunities/${convo.opportunity_id}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2.5"
            >
              View related opportunity →
            </Link>
          )}

          {showActions && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {convo.status === "New" && (
                <Button variant="outline" size="sm" onClick={() => onReview && onReview(convo)}>
                  <Check className="w-3.5 h-3.5 mr-1.5" /> Mark reviewed
                </Button>
              )}
              {convo.status !== "Archived" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => onArchive && onArchive(convo)}
                >
                  <Archive className="w-3.5 h-3.5 mr-1.5" /> Archive
                </Button>
              )}
              {onCorrect && (
                <button
                  onClick={() => onCorrect(convo)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:ml-auto"
                >
                  <AlertCircle className="w-3.5 h-3.5" /> Wrong classification?
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}