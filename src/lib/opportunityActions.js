import { base44 } from "@/api/base44Client";
import { NEW_STATUSES, lifecycleStatus } from "@/lib/opportunityLifecycle";

// Shared opportunity workflow actions, used by the opportunity detail page
// and the actions page so the underlying data stays consistent everywhere.

export async function approveResponse(opp) {
  // Response approval and opportunity status are separate concepts: approving
  // a draft never resolves the customer matter. At most it moves a New
  // opportunity into In Progress.
  const status = NEW_STATUSES.includes(opp.status) ? "In Progress" : opp.status;
  await base44.entities.Opportunity.update(opp.id, {
    status,
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
    description: `Response approved for ${opp.customer_name}'s ${(opp.type || "").toLowerCase()} — recorded in Relay, no external message was sent`,
  });

  if (lifecycleStatus(status) === "In Progress") {
    await base44.entities.Activity.create({
      restaurant_id: opp.restaurant_id,
      opportunity_id: opp.id,
      type: "status_update",
      description: "Opportunity remains In Progress — the customer matter is still open",
    });
  }
}

export async function resolveOpportunity(opp, note) {
  const updates = { status: "Resolved" };
  if (note) {
    // Keep the resolution note visible on the opportunity alongside any
    // existing manager notes.
    updates.notes = opp.notes ? `${opp.notes}\n${note}` : note;
  }
  await base44.entities.Opportunity.update(opp.id, updates);

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
    type: "opportunity_resolved",
    description:
      `Opportunity marked Resolved — ${opp.title}` + (note ? ` · Note: ${note}` : ""),
  });
}

export async function reopenOpportunity(opp) {
  await base44.entities.Opportunity.update(opp.id, { status: "In Progress" });
  await base44.entities.Activity.create({
    restaurant_id: opp.restaurant_id,
    opportunity_id: opp.id,
    type: "opportunity_reopened",
    description: `Opportunity reopened: ${opp.title}`,
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