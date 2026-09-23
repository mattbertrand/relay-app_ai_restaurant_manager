import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Mail, Phone, User, Send, X, Check, Edit3, Save,
  DollarSign, Lightbulb, MessageSquare, Clock, Sparkles,
} from "lucide-react";
import { formatValueRange, formatDate, timeAgo } from "@/lib/format";

export default function OpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [opp, setOpp] = useState(null);
  const [activities, setActivities] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [o, acts] = await Promise.all([
        base44.entities.Opportunity.get(id),
        base44.entities.Activity.list("-created_date", 50),
      ]);
      setOpp(o);
      setDraft(o.draft_response || "");
      setActivities((acts || []).filter((a) => !a.opportunity_id || a.opportunity_id === id));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApproveAndSend = async () => {
    setActionLoading(true);
    try {
      await base44.entities.Opportunity.update(id, { status: "Completed" });
      await base44.entities.Activity.create({
        restaurant_id: opp.restaurant_id,
        opportunity_id: id,
        type: "response_approved",
        description: `Response approved and sent to ${opp.customer_name}`,
      });
      setSent(true);
      setOpp({ ...opp, status: "Completed" });
      setTimeout(() => loadData(), 1500);
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async () => {
    setActionLoading(true);
    try {
      await base44.entities.Opportunity.update(id, { status: "Dismissed" });
      await base44.entities.Activity.create({
        restaurant_id: opp.restaurant_id,
        opportunity_id: id,
        type: "opportunity_dismissed",
        description: `Opportunity dismissed: ${opp.title}`,
      });
      navigate("/opportunities");
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
      setActionLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    setActionLoading(true);
    try {
      await base44.entities.Opportunity.update(id, { draft_response: draft });
      setOpp({ ...opp, draft_response: draft });
      setEditing(false);
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center pt-20">
        <p className="text-muted-foreground">This opportunity could not be found.</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/opportunities">Back to Opportunities</Link></Button>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto pb-20 md:pb-8">
      <Link to="/opportunities" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Opportunities
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">{opp.type}</span>
          <PriorityBadge priority={opp.priority} />
          <StatusBadge status={opp.status} />
        </div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{opp.title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{opp.description}</p>
      </div>

      {/* Value & Source */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <DollarSign className="w-3.5 h-3.5" /> Estimated value
          </div>
          <div className="font-heading text-lg font-semibold text-foreground">
            {formatValueRange(opp.estimated_value_min, opp.estimated_value_max)}
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <MessageSquare className="w-3.5 h-3.5" /> Source
          </div>
          <div className="font-heading text-lg font-semibold text-foreground">{opp.source || "—"}</div>
        </div>
      </div>

      {/* Customer info */}
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Customer</h2>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">{opp.customer_name}</span>
          </div>
          {opp.customer_email && (
            <div className="flex items-center gap-2.5 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <a href={`mailto:${opp.customer_email}`} className="text-primary hover:underline">{opp.customer_email}</a>
            </div>
          )}
          {opp.customer_phone && (
            <div className="flex items-center gap-2.5 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{opp.customer_phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Original message */}
      {opp.original_message && (
        <div className="bg-card rounded-xl border border-border p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">Original Message</h2>
          <div className="bg-secondary/40 rounded-lg p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {opp.original_message}
          </div>
        </div>
      )}

      {/* Why identified */}
      {opp.why_identified && (
        <div className="bg-accent/5 rounded-xl border border-accent/20 p-5 mb-6">
          <div className="flex items-start gap-2.5">
            <Lightbulb className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Why Relay flagged this</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{opp.why_identified}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recommended action */}
      {opp.recommended_action && (
        <div className="bg-primary/5 rounded-xl border border-primary/20 p-5 mb-6">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Recommended Next Action</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{opp.recommended_action}</p>
            </div>
          </div>
        </div>
      )}

      {/* Draft response */}
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Draft Response</h2>
          {!editing && !sent && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
          )}
        </div>
        {sent ? (
          <div className="flex items-center gap-2 text-emerald-600 text-sm py-2">
            <Check className="w-4 h-4" /> Response sent to {opp.customer_name}
          </div>
        ) : editing ? (
          <div className="space-y-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button onClick={handleSaveDraft} disabled={actionLoading} size="sm">
                <Save className="w-3.5 h-3.5 mr-1.5" /> Save
              </Button>
              <Button variant="outline" onClick={() => { setEditing(false); setDraft(opp.draft_response || ""); }} size="sm">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-secondary/40 rounded-lg p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {draft || "No draft prepared yet."}
          </div>
        )}
      </div>

      {/* Notes */}
      {opp.notes && (
        <div className="bg-card rounded-xl border border-border p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-2">Notes</h2>
          <p className="text-sm text-muted-foreground">{opp.notes}</p>
        </div>
      )}

      {/* Activity history */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Activity History</h2>
        {(!activities || activities.length === 0) ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            {activities.map((act) => (
              <div key={act.id} className="flex items-start gap-3 p-4">
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-foreground">{act.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(act.created_date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {!sent && opp.status !== "Dismissed" && opp.status !== "Completed" && (
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button onClick={handleApproveAndSend} disabled={actionLoading} className="flex-1">
            <Send className="w-4 h-4 mr-2" /> Approve & Send
          </Button>
          <Button variant="outline" onClick={() => setEditing(true)} disabled={actionLoading} className="flex-1">
            <Edit3 className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button variant="ghost" onClick={handleDismiss} disabled={actionLoading} className="text-muted-foreground">
            <X className="w-4 h-4 mr-2" /> Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}