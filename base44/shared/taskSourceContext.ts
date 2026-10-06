// Loads the source item behind a follow-up task (email, review, or
// opportunity) as compact context for draft generation and task parsing —
// the same relationship the Task entity already stores, read back safely.

export async function loadSourceContext(base44, restaurantId, sourceType, sourceId) {
  try {
    if (!sourceId) return "(no source context)";
    if (sourceType === "email") {
      const c = await base44.entities.Conversation.get(sourceId);
      if (!c || c.restaurant_id !== restaurantId) return "(no source context)";
      let oppLine = "";
      if (c.opportunity_id) {
        const o = await base44.entities.Opportunity.get(c.opportunity_id).catch(() => null);
        if (o) {
          oppLine = `\nLinked opportunity: ${o.title}${o.description ? ` — ${o.description}` : ""}`;
        }
      }
      return `Email thread — subject: ${c.subject}\nFrom: ${c.customer_name}${c.customer_email ? ` <${c.customer_email}>` : ""}\nCustomer message: ${String(c.message || "").slice(0, 1500)}${oppLine}`;
    }
    if (sourceType === "review") {
      const r = await base44.entities.Review.get(sourceId);
      if (!r || r.restaurant_id !== restaurantId) return "(no source context)";
      return `Review — ${r.rating || "?"} stars from ${r.reviewer_name || "unknown"} on ${r.provider || "a review site"}\nReview: ${String(r.review_text || "(no text)").slice(0, 1200)}${r.manager_status ? `\nManager status: ${r.manager_status}` : ""}`;
    }
    if (sourceType === "opportunity") {
      const o = await base44.entities.Opportunity.get(sourceId);
      if (!o || o.restaurant_id !== restaurantId) return "(no source context)";
      return `Opportunity — ${o.type || "General"}: ${o.title}\n${o.description || ""}\nCustomer: ${o.customer_name || "unknown"}${o.original_message ? `\nOriginal message: ${String(o.original_message).slice(0, 1200)}` : ""}`;
    }
    return "(no source context)";
  } catch (e) {
    return "(no source context)";
  }
}

// Keeps an email's workflow_status in step with its linked Opportunity:
// New → In Progress → Resolved (Dismissed archives it). Response state
// (status) is never touched here — those are two different concepts.
export async function syncConversationWorkflow(base44, restaurantId, opportunityId, stage) {
  if (!opportunityId) return 0;
  const next = { "In Progress": "In Progress", Resolved: "Resolved", Dismissed: "Archived", New: "New" }[stage];
  if (!next) return 0;
  try {
    const page = await base44.entities.Conversation.filter(
      { restaurant_id: restaurantId, opportunity_id: opportunityId },
      { limit: 20 }
    );
    const convos = (Array.isArray(page) ? page : page.items || []).filter((c) => {
      const current = c.workflow_status || (c.status === "Archived" ? "Archived" : "New");
      return current !== next;
    });
    if (convos.length) {
      await base44.entities.Conversation.bulkUpdate(
        convos.map((c) => ({ id: c.id, workflow_status: next }))
      );
    }
    return convos.length;
  } catch (e) {
    return 0;
  }
}