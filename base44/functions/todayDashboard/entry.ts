import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { loadKnowledge } from "../../shared/restaurantKnowledge.ts";

// Today dashboard: one server-side pass over the restaurant's actual Relay
// data — workload counts, prioritized attention items, follow-ups, review
// summary, in-progress and revenue opportunities, and dated items for Today &
// Upcoming. No numbers are invented; nothing is counted twice.

const ACTIVE_OPP = (status) =>
  !(["Resolved", "Completed", "Dismissed"].includes(status)) &&
  status !== undefined && status !== null && status !== "";

const REVENUE_TYPES = [
  "Private event inquiry",
  "Catering inquiry",
  "Business inquiry",
  "Reservation inquiry",
];

function guestsFrom(text) {
  const t = String(text || "");
  const range = /(\d{1,4})\s*(?:-|–|to)\s*(\d{1,4})\s*(?:guests?|people|persons?|attendees?)/i.exec(t);
  if (range) return `${range[1]}–${range[2]} guests`;
  const single = /(\d{1,4})\s*(?:guests?|people|persons?|attendees?)/i.exec(t);
  return single ? `${single[1]} guests` : null;
}

function firstLine(text, max = 160) {
  const s = String(text || "").split("\n").find((l) => l.trim());
  return s ? (s.length > max ? s.slice(0, max) + "…" : s) : "";
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const restaurantId = user.restaurant_id || (user.data && user.data.restaurant_id);
    if (!restaurantId) {
      return Response.json({ error: 'No restaurant is set up for this account yet.' }, { status: 400 });
    }

    const [knowledge, convoPage, oppPage, actionPage, reviewPage] = await Promise.all([
      loadKnowledge(base44, restaurantId),
      base44.entities.Conversation.filter({ restaurant_id: restaurantId }, { sort: "-created_date", limit: 300 }),
      base44.entities.Opportunity.filter({ restaurant_id: restaurantId }, { sort: "-created_date", limit: 300 }),
      base44.entities.Action.filter({ restaurant_id: restaurantId }, { sort: "-created_date", limit: 200 }),
      base44.entities.Review.filter({ restaurant_id: restaurantId }, { sort: "-created_date", limit: 300 }),
    ]);
    const convos = convoPage.items || [];
    const opps = oppPage.items || [];
    const actions = actionPage.items || [];
    const reviews = reviewPage.items || [];

    // The restaurant's local date anchors "today" and the 30-day window.
    const tz = (knowledge && knowledge.timezone) || "America/Los_Angeles";
    const inTz = (date, opts) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, ...opts }).format(date);
    const today = inTz(new Date(), { year: "numeric", month: "2-digit", day: "2-digit" });
    const horizon = inTz(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), { year: "numeric", month: "2-digit", day: "2-digit" });
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(new Date());

    const firstName = (user.full_name || "").trim().split(/\s+/)[0] || "there";

    // ---- Workload counts (each record counted exactly once per line) ----
    const newConvos = convos.filter((c) => c.status === "New");
    const activeOpps = opps.filter((o) => ACTIVE_OPP(o.status));
    const pendingFollowUps = actions.filter((a) => a.type === "Follow-up" && a.status === "Pending Approval");
    const newReviews = reviews.filter((r) => (r.manager_status || "New") === "New");
    const needsResponseReviews = reviews.filter(
      (r) => r.classification === "Attention" && ["New", "In Progress"].includes(r.manager_status || "New")
    );

    const breakdown = { opportunity: 0, attention: 0, administrative: 0, informational: 0, spam: 0, needs_review: 0 };
    for (const c of newConvos) {
      if (c.analysis_status === "Opportunity") breakdown.opportunity++;
      else if (c.analysis_status === "Attention") breakdown.attention++;
      else if (c.analysis_status === "Administrative") breakdown.administrative++;
      else if (c.analysis_status === "Routine" || c.analysis_status === "No opportunity") breakdown.informational++;
      else if (c.analysis_status === "Spam") breakdown.spam++;
      else breakdown.needs_review++;
    }

    // ---- Needs Your Attention (prioritized; each record appears once) ----
    const items = [];
    for (const a of pendingFollowUps) {
      const overdue = !!a.due_date && a.due_date < today;
      items.push({
        kind: "follow_up",
        urgency: overdue ? "overdue" : a.due_date && a.due_date === today ? "due" : "normal",
        score: overdue ? 100 : a.due_date && a.due_date === today ? 90 : 55,
        label: "CUSTOMER FOLLOW-UP",
        title: a.description,
        lines: [a.due_date ? (overdue ? `Was due ${a.due_date}` : `Due ${a.due_date}`) : "Needs a due date"],
        link: a.opportunity_id ? `/opportunities/${a.opportunity_id}` : "/actions",
        focus_conversation_id: a.conversation_id || "",
      });
    }
    for (const c of newConvos) {
      if (c.analysis_status !== "Attention") continue;
      const repeated = /repea|multiple|several|unanswered|never (got|received)|waiting|tried (calling|twice|again)/i.test(
        `${c.why_flagged || ""} ${c.intent || ""} ${c.message || ""}`
      );
      items.push({
        kind: "email",
        urgency: repeated ? "high" : "normal",
        score: repeated ? 80 : 60,
        label: (c.intent || "CUSTOMER INQUIRY").toUpperCase(),
        title: c.subject,
        lines: [
          `From ${c.customer_name}`,
          repeated
            ? "Customer has contacted the restaurant multiple times without receiving a response — immediate attention recommended."
            : c.recommended_action || c.why_flagged || "",
        ].filter(Boolean),
        link: "/inbox",
        focus_conversation_id: c.id,
      });
    }
    for (const o of activeOpps) {
      if (o.priority !== "high") continue;
      items.push({
        kind: "opportunity",
        urgency: "high",
        score: 75,
        label: (o.type || "OPPORTUNITY").toUpperCase(),
        title: o.title,
        lines: [o.recommended_action || o.description || "", o.customer_name ? `Customer: ${o.customer_name}` : ""].filter(Boolean),
        link: `/opportunities/${o.id}`,
        focus_conversation_id: "",
      });
    }
    for (const r of needsResponseReviews) {
      items.push({
        kind: "review",
        urgency: r.rating <= 2 ? "high" : "normal",
        score: r.rating <= 2 ? 70 : 50,
        label: "REVIEW NEEDS RESPONSE",
        title: `${r.rating ? "★".repeat(r.rating) + " " : ""}${r.provider === "google" ? "Google" : r.provider || "Review"} — ${r.reviewer_name || "Reviewer"}`,
        lines: [firstLine(r.review_text, 120), r.why_flagged || ""].filter(Boolean),
        link: `/reviews/${r.id}`,
        focus_conversation_id: "",
      });
    }
    items.sort((a, b) => b.score - a.score);
    const attentionItems = items.slice(0, 6);

    // ---- Follow-ups ----
    const followUps = pendingFollowUps
      .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))
      .slice(0, 6)
      .map((a) => ({
        id: a.id,
        description: a.description,
        due_date: a.due_date || "",
        overdue: !!a.due_date && a.due_date < today,
        due_today: a.due_date === today,
        link: a.opportunity_id ? `/opportunities/${a.opportunity_id}` : "/inbox",
        focus_conversation_id: a.conversation_id || "",
      }));

    // ---- Revenue opportunities ----
    const revenueOpps = activeOpps
      .filter((o) => REVENUE_TYPES.includes(o.type) || (o.estimated_value_min && o.estimated_value_min > 0))
      .sort((a, b) => (b.priority === "high") - (a.priority === "high"))
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        title: o.title,
        type: o.type,
        guests: guestsFrom(`${o.description || ""} ${o.original_message || ""}`),
        note: firstLine(o.description || o.why_identified || "", 180),
        status: o.status,
        link: `/opportunities/${o.id}`,
      }));

    // ---- Opportunities in progress ----
    const inProgress = opps
      .filter((o) => o.status === "In Progress")
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        title: o.title,
        customer: o.customer_name || "",
        waiting: o.recommended_action || firstLine(o.notes || "", 120) || "",
        link: `/opportunities/${o.id}`,
      }));

    // ---- Reviews summary ----
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of newReviews) {
      const stars = Math.min(5, Math.max(1, Number(r.rating) || 0));
      if (distribution[stars] !== undefined) distribution[stars]++;
    }

    // ---- Today & Upcoming (only what Relay actually knows) ----
    const todayItems = [];
    const upcomingItems = [];
    for (const a of pendingFollowUps) {
      if (!a.due_date) continue;
      if (a.due_date === today) todayItems.push({ date: a.due_date, label: `Follow-up due — ${a.description}` });
      else if (a.due_date > today && a.due_date <= horizon) upcomingItems.push({ date: a.due_date, label: `Follow-up due — ${a.description}` });
    }
    for (const o of activeOpps) {
      if (!o.event_date) continue;
      if (o.event_date === today) todayItems.push({ date: o.event_date, label: o.title });
      else if (o.event_date > today && o.event_date <= horizon) upcomingItems.push({ date: o.event_date, label: o.title });
    }
    const tempHours = (knowledge && Array.isArray(knowledge.temporary_hours) ? knowledge.temporary_hours : []).filter(Boolean);
    for (const t of tempHours) {
      if (!t.start_date) continue;
      const label = `${t.label || "Special hours"}${t.note ? ` — ${t.note}` : ""}`;
      if (t.start_date <= today && (!t.end_date || t.end_date >= today)) {
        todayItems.push({ date: t.start_date, label });
      } else if (t.start_date > today && t.start_date <= horizon) {
        upcomingItems.push({ date: t.start_date, label: `${label}${t.end_date ? ` (through ${t.end_date})` : ""}` });
      }
    }
    const offerings = (knowledge && Array.isArray(knowledge.recurring_offerings) ? knowledge.recurring_offerings : []).filter(Boolean);
    for (const o of offerings) {
      if (!o.name || !o.days || !new RegExp(`\\b${o.days.split(/[,/]/)[0].trim()}\\b`, "i").test(weekday) && !o.days.toLowerCase().includes(weekday.toLowerCase())) continue;
      todayItems.push({ date: today, label: `${o.name}${o.time ? ` — ${o.time}` : ""}` });
    }
    todayItems.sort((a, b) => a.date.localeCompare(b.date));
    upcomingItems.sort((a, b) => a.date.localeCompare(b.date));

    return Response.json({
      manager_first_name: firstName,
      summary: {
        new_emails: newConvos.length,
        emails: breakdown,
        opportunities: activeOpps.length,
        immediate_attention: breakdown.attention + activeOpps.filter((o) => o.priority === "high").length,
        follow_ups: pendingFollowUps.length,
        new_reviews: newReviews.length,
        reviews_needs_response: needsResponseReviews.length,
      },
      attention_items: attentionItems,
      follow_ups: followUps,
      revenue_opportunities: revenueOpps,
      in_progress: inProgress,
      reviews: {
        new: newReviews.length,
        needs_response: needsResponseReviews.length,
        distribution,
      },
      today_items: todayItems.slice(0, 6),
      upcoming_items: upcomingItems.slice(0, 4),
      upcoming_all: upcomingItems.slice(0, 20),
      has_demo: [...convos, ...opps, ...actions, ...reviews].some((r) => r.is_demo),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}