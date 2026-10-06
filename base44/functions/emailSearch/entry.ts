import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Natural-language email search over the emails Relay has IMPORTED (New,
// Reply recorded, and Archived alike — Gmail itself is never queried here, so
// messages that were never imported can't be found and nothing is invented).
//
// Cost-conscious by design: ONE structured read of the manager's words turns
// the request into search criteria (senders, keywords, phrases, dates,
// status, classification) — never a call against every stored email. The
// criteria are then matched and ranked against the stored records with plain
// string scoring. Search is strictly read-only: it never creates or changes
// opportunities, drafts, or analysis.

const CRITERIA_SCHEMA = {
  type: "object",
  properties: {
    senders: {
      type: "array",
      items: { type: "string" },
      description:
        "Person or company names / email addresses the manager named, in lowercase (e.g. 'josh', 'sysco'). Empty if none.",
    },
    keywords: {
      type: "array",
      items: { type: "string" },
      description:
        "Distinctive words or short phrases likely to appear in the message text, in lowercase, including obvious alternate spellings (e.g. 'invoice', 'private event', 'concert seating'). Empty if none.",
    },
    phrases: {
      type: "array",
      items: { type: "string" },
      description:
        "Exact phrases that must appear somewhere in the message, in lowercase — e.g. program or event names like 'dine & donate' or 'dine and donate'. Empty if none.",
    },
    classifications: {
      type: "array",
      items: { type: "string" },
      description:
        "Relay classifications the manager implied: opportunity, attention, administrative, routine, spam, needs review. Empty if none.",
    },
    statuses: {
      type: "array",
      items: { type: "string" },
      description:
        "Inbox states the manager implied: new, reply recorded, archived. Empty (all states, including archived) if none.",
    },
    date_from: {
      type: "string",
      description: "Inclusive start date YYYY-MM-DD the manager implied, or empty string. Relative dates like 'last month' resolved against today.",
    },
    date_to: {
      type: "string",
      description: "Inclusive end date YYYY-MM-DD the manager implied, or empty string.",
    },
  },
  required: ["senders", "keywords", "phrases"],
};

const STOP_WORDS = new Set([
  "find", "the", "email", "emails", "message", "messages", "about", "from", "show", "me", "and",
  "with", "for", "that", "this", "please", "search", "look", "a", "an", "of", "in", "on", "my",
]);

function fallbackCriteria(query) {
  const phrases = [...query.matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase());
  let rest = query.replace(/"([^"]+)"/g, " ");
  const senders = [];
  const fromMatch = rest.match(/\bfrom\s+([A-Za-z0-9'&.\- ]{2,40})/i);
  if (fromMatch) {
    senders.push(fromMatch[1].trim().toLowerCase());
    rest = rest.replace(fromMatch[0], " ");
  }
  const keywords = rest
    .toLowerCase()
    .split(/[^a-z0-9&']+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return { senders, keywords, phrases, classifications: [], statuses: [], date_from: "", date_to: "" };
}

const lc = (s) => String(s || "").toLowerCase();

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const restaurantId = user.restaurant_id || (user.data && user.data.restaurant_id);
    if (!restaurantId) {
      return Response.json({ error: 'No restaurant is set up for this account yet.' }, { status: 400 });
    }

    const payload = await req.json().catch(() => ({}));
    let query = String(payload.query || "").trim().slice(0, 300);
    if (!query) return Response.json({ results: [] });

    // 1. Interpret the manager's words — one structured call, never per email.
    let criteria = null;
    try {
      const today = new Date().toISOString().slice(0, 10);
      criteria = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `A restaurant manager typed this search into their email inbox in Relay: "${query}"

Today's date is ${today}. Turn the request into structured search criteria for finding emails Relay has imported.
- senders: any person, restaurant, company, or team name, or email address, the manager wants messages FROM (lowercase). "the Google Community Team message" → ["google community team"].
- keywords: distinctive words likely to appear in the message text, in lowercase, including obvious variants (e.g. a request also mentions "donate dinner", "fundraiser"). Expand an abbreviated or informal term into its likely full wording too (e.g. "dine & donate" also "dine and donate").
- phrases: exact phrases that must appear (lowercase), e.g. a program name.
- classifications / statuses / date_from / date_to: only when clearly implied. "last month" means the previous calendar month; "yesterday", "last week", "this week" resolved against today. Never guess a date range the manager did not imply.
Leave arrays empty and dates "" when not implied. Return JSON only.`,
        response_json_schema: CRITERIA_SCHEMA,
      });
    } catch (e) {
      criteria = null;
    }
    if (!criteria) criteria = fallbackCriteria(query);

    const senders = (criteria.senders || []).map(lc).filter(Boolean);
    const phrases = (criteria.phrases || []).map(lc).filter(Boolean);
    const keywords = (criteria.keywords || []).map(lc).filter((t) => t.length > 1);
    const classifications = (criteria.classifications || []).map(lc).filter(Boolean);
    const statuses = (criteria.statuses || []).map(lc).filter(Boolean);
    const dateFrom = criteria.date_from || "";
    const dateTo = criteria.date_to || "";

    // 2. Efficient search over the stored emails. All inbox states are
    // included — archived messages stay findable; the manager filters them
    // out explicitly when a status was implied.
    const [convoPage, oppPage] = await Promise.all([
      base44.entities.Conversation.filter(
        { restaurant_id: restaurantId },
        { sort: "-received_at", limit: 1000 }
      ),
      base44.entities.Opportunity.filter({ restaurant_id: restaurantId }, { limit: 500 }),
    ]);
    const oppById = {};
    for (const o of oppPage.items || []) oppById[o.id] = o;

    const now = Date.now();
    const scored = [];
    for (const c of convoPage.items || []) {
      const subject = lc(c.subject);
      const body = lc(c.message);
      const sender = `${lc(c.customer_name)} ${lc(c.customer_email)}`;
      const category = lc(c.category);
      const intent = lc(c.intent);
      const opp = c.opportunity_id ? oppById[c.opportunity_id] : null;
      const oppTitle = lc(opp && opp.title);

      if (phrases.length) {
        const haystack = `${subject} ${body} ${intent} ${category} ${oppTitle}`;
        if (!phrases.every((p) => haystack.includes(p))) continue;
      }
      // A sender the manager named matches either the From line or the name
      // signed in the message body — greetings and signatures often carry the
      // real person's name when the display name is an account holder's.
      const senderFromLine = senders.length && senders.some((s) => sender.includes(s));
      const senderInBody = senders.length && !senderFromLine && senders.some((s) => body.includes(s));
      if (senders.length && !senderFromLine && !senderInBody) continue;
      if (statuses.length) {
        const st = lc(c.status);
        if (!statuses.some((s) => st === s || st.includes(s))) continue;
      }
      if (classifications.length) {
        const cls = lc(c.analysis_status);
        if (!classifications.some((x) => cls.includes(x))) continue;
      }
      const ts = c.received_at || c.created_date || "";
      if (dateFrom && ts && ts.slice(0, 10) < dateFrom) continue;
      if (dateTo && ts && ts.slice(0, 10) > dateTo) continue;

      let score = 0;
      let matchedKeywords = 0;
      for (const k of keywords) {
        if (subject.includes(k)) { score += 30; matchedKeywords++; }
        if (oppTitle.includes(k)) { score += 25; matchedKeywords++; }
        if (intent.includes(k) || category.includes(k)) { score += 20; matchedKeywords++; }
        if (sender.includes(k)) { score += 15; matchedKeywords++; }
        if (body.includes(k)) { score += 10; matchedKeywords++; }
      }
      if (keywords.length && matchedKeywords === 0) continue;
      if (senderFromLine) score += 40;
      else if (senderInBody) score += 20;
      // Gentle recency tiebreak so equally relevant results read newest-first.
      const ageDays = ts ? (now - new Date(ts).getTime()) / 86400000 : 365;
      score += Math.max(0, 10 - Math.floor(ageDays / 30));

      scored.push({ c, score, opp });
    }

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, 20).map(({ c, opp }) => ({
      id: c.id,
      sender: c.customer_name || "",
      sender_email: c.customer_email || "",
      subject: c.subject || "",
      snippet: String(c.message || "").slice(0, 180),
      received_at: c.received_at || c.created_date || "",
      status: c.status || "",
      analysis_status: c.analysis_status || "",
      opportunity_id: opp ? opp.id : "",
      opportunity_title: opp ? opp.title || "" : "",
    }));

    return Response.json({
      query,
      interpreted: {
        senders,
        keywords,
        phrases,
        statuses,
        classifications,
        date_from: dateFrom || null,
        date_to: dateTo || null,
      },
      searched: (convoPage.items || []).length,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}