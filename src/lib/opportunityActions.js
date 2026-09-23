import { base44 } from "@/api/base44Client";

// Shared opportunity workflow actions, used by both the opportunity detail page
// and the actions page so the underlying data stays consistent everywhere.

export async function approveResponse(opp) {
  await base44.entities.Opportunity.update(opp.id, {
    status: "In Progress",
    draft_status: "Approved",
  });

  // Complete any pending actions tied to this opportunity so pending counts
  // stay accurate across the dashboard and actions pages.
  const pending = await base44.entities.Action.filter({
    opportunity_id: opp.id,
    status: "Pending Approval",
  });
  if (pending.length) {
    await base44.entities.Action.bulkUpdate(
      pending.map((a) => ({
        id: a.id,
        status: "Completed",
        completed_at: new Date().toISOString(),
      }))
    );
  }

  await base44.entities.Activity.create({
    restaurant_id: opp.restaurant_id,
    opportunity_id: opp.id,
    type: "response_approved",
    description: `Response approved for ${opp.customer_name}'s ${(opp.type || "").toLowerCase()} — demo action completed, no external message was sent`,
  });
}

export async function dismissOpportunity(opp, reason) {
  await base44.entities.Opportunity.update(opp.id, {
    status: "Dismissed",
    dismiss_reason: reason || "",
  });

  const pending = await base44.entities.Action.filter({
    opportunity_id: opp.id,
    status: "Pending Approval",
  });
  if (pending.length) {
    await base44.entities.Action.bulkUpdate(
      pending.map((a) => ({ id: a.id, status: "Dismissed" }))
    );
  }

  await base44.entities.Activity.create({
    restaurant_id: opp.restaurant_id,
    opportunity_id: opp.id,
    type: "opportunity_dismissed",
    description:
      `Opportunity dismissed — ${opp.title}` + (reason ? ` · Reason: ${reason}` : ""),
  });
}