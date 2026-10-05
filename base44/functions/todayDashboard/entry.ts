import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { loadKnowledge } from "../../shared/restaurantKnowledge.ts";
import { calendarScheduleContext } from "../../shared/calendarSchedule.ts";

// Today dashboard — one server-side pass producing the manager's one-minute
// day: headline counts, the unified "Needs Action" queue (labels, not
// sections), new emails, new reviews by provider, the calendar schedule, and
// dated commitments for Today & Upcoming. No numbers are invented and nothing
// is counted twice: follow-ups, emails, opportunities, and reviews each feed
// exactly one count.

const ACTIVE_OPP = (status) =>
  !(["Resolved", "Completed", "Dismissed"].includes(status)) &&
  status !== undefined && status !== null && status !== "";

const REVENUE_TYPES = [
  "Private event inquiry",
  "Catering inquiry",
  "Business inquiry",
  "Reservation inquiry",
];

function firstLine(text, max = 160) {
  const s = String(text || "").split("\n").find((l) => l.trim());
  return s ? (s.length > max ? s.slice(0, max) + "…" : s) : "";
}

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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

    // The restaurant's local date anchors "today" and the windows.
    const tz = (knowledge && knowledge.timezone) || "America/Los_Angeles";
    const inTz = (date, opts) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, ...opts }).format(date);
    const today = inTz(new Date(), { year: "numeric", month: "2-digit", day: "2-digit" });
    const horizon = addDays(today, 30);
    const sevenDays = addDays(today, 7);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(new Date());

    // The manager's connected calendar — provider-agnostic; never throws.
    const schedule = await calendarScheduleContext(base44, knowledge ? knowledge.timezone : null);

    const firstName = (user.full_name || "").trim().split(/\s+/)[0] || "there";

    const newConvos = convos.filter((c) => c.status === "New");
    const activeOpps = opps.filter((o) => ACTIVE_OPP(o.status));
    const pendingFollowUps = actions.filter((a) => a.type === "Follow-up" && a.status === "Pending Approval");
    const newReviews = reviews.filter((r) => (r.manager_status || "New") === "New");

    const breakdown = { opportunity: 0, attention: 0, administrative: 0, informational: 0, spam: 0, needs_review: 0 };
    for (const c of newConvos) {
      if (c.analysis_status === "Opportunity") breakdown.opportunity++;
      else if (c.analysis_status === "Attention") breakdown.attention++;
      else if (c.analysis_status === "Administrative") breakdown.administrative++;
      else if (c.analysis_status === "Routine" || c.analysis_status === "No opportunity") breakdown.informational++;
      else if (c.analysis_status === "Spam") breakdown.spam++;
      else breakdown.needs_review++;
    }

    // ---- Needs Action: the ONE prioritized queue. Revenue, In Progress, and
    // Attention are tags here — never separate sections. ----
    const queue = [];

    // 1. Follow-ups the manager personally promised (recorded responses only).
    for (const a of pendingFollowUps) {
      const overdue = !!a.due_date && a.due_date < today;
      const dueToday = a.due_date === today;
      queue.push({
        kind: "follow_up",
        id: a.id,
        urgency: overdue ? "overdue" : dueToday ? "due" : "normal",
        score: overdue ? 100 : dueToday ? 90 : a.due_date ? 55 : 65,
        tags: ["Follow-up"],
        title: a.description,
        when: overdue ? "Overdue" : dueToday ? "Due today" : a.due_date ? `Due ${a.due_date}` : "Needs scheduling",
        lines: [],
        link: a.opportunity_id ? `/opportunities/${a.opportunity_id}` : "/actions",
        focus_conversation_id: a.conversation_id || "",
      });
    }

    // 2. New emails that genuinely need the manager.
    for (const c of newConvos) {
      if (c.analysis_status === "Attention") {
        const repeated = /repea|multiple|several|unanswered|never (got|received)|waiting|tried (calling|twice|again)/i.test(
          `${c.why_flagged || ""} ${c.intent || ""} ${c.message || ""}`
        );
        queue.push({
          kind: "email",
          id: c.id,
          urgency: repeated ? "high" : "normal",
          score: repeated ? 85 : 60,
          tags: ["Customer"],
          title: c.subject,
          when: "",
          lines: [`From ${c.customer_name}`, firstLine(c.recommended_action || c.why_flagged || "", 140)].filter(Boolean),
          link: "/inbox",
          focus_conversation_id: c.id,
        });
      } else if (c.analysis_status === "Administrative") {
        const isVendor = (c.category || "") === "vendor";
        queue.push({
          kind: "email",
          id: c.id,
          urgency: "normal",
          score: 45,
          tags: isVendor ? ["Vendor", "Administrative"] : ["Administrative"],
          title: c.subject,
          when: "",
          lines: [`From ${c.customer_name}`, firstLine(c.recommended_action || "", 140)].filter(Boolean),
          link: "/inbox",
          focus_conversation_id: c.id,
        });
      }
    }

    // 3. Active opportunities — New and In Progress alike; status is a tag.
    for (const o of activeOpps) {
      const tags = [];
      tags.push(o.status === "In Progress" ? "In Progress" : "New");
      if (REVENUE_TYPES.includes(o.type) || (o.estimated_value_min && o.estimated_value_min > 0)) {
        tags.push("Revenue opportunity");
      }
      if (/reservation/i.test(o.type || "")) tags.push("Reservation");
      if (/private event|catering/i.test(o.type || "")) tags.push("Event");
      if (/vendor/i.test(o.type || "")) tags.push("Vendor");
      if (o.priority === "high") tags.push("High priority");
      const soon = o.event_date && o.event_date >= today && o.event_date <= sevenDays;
      queue.push({
        kind: "opportunity",
        id: o.id,
        urgency: o.priority === "high" ? "high" : "normal",
        score:
          (o.priority === "high" ? 75 : o.priority === "low" ? 45 : 60) +
          (soon ? 8 : 0) +
          (o.status === "In Progress" ? 5 : 0),
        tags,
        title: o.title,
        when: o.event_date ? (o.event_date === today ? "Today" : `Event ${o.event_date}`) : "",
        lines: [
          firstLine(o.recommended_action || o.description || "", 140),
          o.customer_name ? `Customer: ${o.customer_name}` : "",
        ].filter(Boolean),
        link: `/opportunities/${o.id}`,
        focus_conversation_id: "",
      });
    }

    queue.sort((a, b) => b.score - a.score);

    // A small, meaningful priority level per queue item — High / Normal / Low.
    // High: complaints and same-day issues, overdue or due-today follow-ups,
    // high-priority opportunities, customers already waiting. The rest rank
    // Normal or Low from their urgency score — no complicated scoring in the UI.
    const priorityFor = (item) =>
      item.urgency === "overdue" || item.urgency === "high" || item.urgency === "due"
        ? "High"
        : item.score >= 60
        ? "Normal"
        : "Low";
    for (const item of queue) item.priority = priorityFor(item);

    // ---- New Reviews by provider. Google is the only connected provider
    // today and always appears (a true zero state); any future provider shows
    // up only when it actually has data — no empty placeholders. ----
    const providerLabels = { google: "Google" };
    const providerOrder = ["google"];
    const byProvider = {};
    for (const r of newReviews) (byProvider[r.provider || "google"] = byProvider[r.provider || "google"] || []).push(r);
    const providerRows = [];
    const pushProviderRow = (p) => {
      const list = byProvider[p] || [];
      const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      for (const r of list) {
        const stars = Math.min(5, Math.max(1, Number(r.rating) || 0));
        if (distribution[stars] !== undefined) distribution[stars]++;
      }
      providerRows.push({
        provider: p,
        label: providerLabels[p] || p,
        new: list.length,
        needs_response: list.filter((r) => ["Opportunity", "Attention"].includes(r.classification)).length,
        distribution,
      });
      delete byProvider[p];
    };
    for (const p of providerOrder) pushProviderRow(p);
    for (const p of Object.keys(byProvider).sort()) pushProviderRow(p);

    // ---- Today & Upcoming: only what Relay actually knows. ----
    const todayItems = [];
    const upcomingItems = [];
    for (const a of pendingFollowUps) {
      if (!a.due_date) continue;
      const label = `Follow-up due — ${a.description}`;
      if (a.due_date === today) todayItems.push({ date: a.due_date, label });
      else if (a.due_date > today && a.due_date <= horizon) upcomingItems.push({ date: a.due_date, label });
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
      counts: {
        need_action: queue.length,
        follow_ups: pendingFollowUps.length,
        new_emails: newConvos.length,
        new_reviews: newReviews.length,
        scheduled_today: schedule.connected ? schedule.today.length : 0,
      },
      need_action: queue.slice(0, 50),
      emails: { new: newConvos.length, breakdown },
      reviews: {
        new: newReviews.length,
        needs_response: providerRows.reduce((n, p) => n + p.needs_response, 0),
        providers: providerRows,
      },
      schedule,
      today_items: todayItems.slice(0, 6),
      upcoming_items: upcomingItems.slice(0, 4),
      upcoming_all: upcomingItems.slice(0, 20),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}