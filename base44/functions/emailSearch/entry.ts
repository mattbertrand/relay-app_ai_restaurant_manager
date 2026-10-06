import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Natural-language email search over the emails Relay has IMPORTED (New,
// Reply recorded, and Archived alike — Gmail itself is never queried here, so
// messages that were never imported can't be found and nothing is invented).
//
// v3 — deterministic first. Quoted phrases, "from <name>" senders, status
// words, month names and relative dates are parsed IN CODE, so the same query
// always yields the same criteria: repeated searches, and the same words in a
// different order, return the same results. Every remaining word is a REQUIRED
// keyword — each must appear somewhere in the message. The LLM is only a
// fallback for queries the rules find no criteria for, so its interpretation
// can never make an already-matching search flaky. Search is strictly
// read-only: it never creates or changes opportunities, drafts, or analysis.

const STOP_WORDS = new Set([
  "find", "the", "email", "emails", "message", "messages", "about", "from", "show", "me", "and",
  "with", "for", "that", "this", "please", "search", "look", "a", "an", "of", "in", "on", "my",
  "is", "are", "was", "were", "to", "at", "it", "its", "be", "has", "have", "had", "do", "does",
  "did", "i", "we", "they", "them", "their", "who", "what", "when", "where", "which", "how",
  "all", "any", "get", "by", "as", "or", "if", "so", "no", "not", "up",
]);

// Standalone month words become inclusive date ranges (current year). "May"
// is excluded on purpose — far too common as a plain word.
const MONTH_NAMES = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8,
  october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
};

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
        "Distinctive words or short phrases likely to appear in the message text, in lowercase, including obvious alternate spellings. Empty if none.",
    },
    phrases: {
      type: "array",
      items: { type: "string" },
      description:
        "Exact phrases that must appear somewhere in the message, in lowercase — e.g. program or event names like 'dine & donate'. Empty if none.",
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

const lc = (s) => String(s || "").toLowerCase();
const iso = (d) => d.toISOString().slice(0, 10);

function monthRange(monthIndex, year) {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return { date_from: `${year}-${mm}-01`, date_to: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

// Deterministic criteria extraction — pure string/date logic, no LLM.
function extractCriteria(query) {
  const criteria = { senders: [], phrases: [], keywords: [], statuses: [], classifications: [], date_from: "", date_to: "" };
  let rest = lc(query);

  for (const m of rest.matchAll(/"([^"]+)"/g)) criteria.phrases.push(m[1].trim());
  rest = rest.replace(/"[^"]+"/g, " ");

  const fromMatch = rest.match(/\bfrom\s+([a-z0-9'&.\- ]{2,40})/);
  if (fromMatch) {
    criteria.senders.push(fromMatch[1].trim());
    rest = rest.replace(fromMatch[0], " ");
  }

  const now = new Date();
  let dr = null;
  if (/\byesterday\b/.test(rest)) {
    const d = new Date(now); d.setUTCDate(d.getUTCDate() - 1);
    dr = { date_from: iso(d), date_to: iso(d) };
    rest = rest.replace(/\byesterday\b/g, " ");
  } else if (/\btoday\b/.test(rest)) {
    dr = { date_from: iso(now), date_to: iso(now) };
    rest = rest.replace(/\btoday\b/g, " ");
  } else if (/\bthis week\b/.test(rest)) {
    const f = new Date(now); f.setUTCDate(f.getUTCDate() - 6);
    dr = { date_from: iso(f), date_to: iso(now) };
    rest = rest.replace(/\bthis week\b/g, " ");
  } else if (/\blast week\b/.test(rest)) {
    const t = new Date(now); t.setUTCDate(t.getUTCDate() - 7);
    const f = new Date(t); f.setUTCDate(f.getUTCDate() - 6);
    dr = { date_from: iso(f), date_to: iso(t) };
    rest = rest.replace(/\blast week\b/g, " ");
  } else if (/\bthis month\b/.test(rest)) {
    dr = { date_from: `${iso(now).slice(0, 7)}-01`, date_to: iso(now) };
    rest = rest.replace(/\bthis month\b/g, " ");
  } else if (/\blast month\b/.test(rest)) {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    dr = monthRange(first.getUTCMonth(), first.getUTCFullYear());
    rest = rest.replace(/\blast month\b/g, " ");
  }
  if (dr) Object.assign(criteria, dr);

  const monthPattern = new RegExp(`\\b(${Object.keys(MONTH_NAMES).join("|")})\\b`);
  const monthMatch = rest.match(monthPattern);
  if (monthMatch) {
    Object.assign(criteria, monthRange(MONTH_NAMES[monthMatch[1]], now.getUTCFullYear()));
    rest = rest.replace(new RegExp(`\\b${monthMatch[1]}\\b`, "g"), " ");
  }

  if (/\barchived\b/.test(rest)) {
    criteria.statuses.push("archived");
    rest = rest.replace(/\barchived\b/g, " ");
  }
  if (/\breplied\b/.test(rest)) {
    criteria.statuses.push("reply recorded");
    rest = rest.replace(/\breplied\b/g, " ");
  }

  criteria.keywords = rest
    .split(/[^a-z0-9&']+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return criteria;
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

    const payload = await req.json().catch(() => ({}));
    const query = String(payload.query || "").trim().slice(0, 300);
    if (!query) return Response.json({ results: [] });

    // 1. Deterministic criteria from the manager's own words.
    let criteria = extractCriteria(query);
    let interpretedBy = "rules";
    if (!criteria.keywords.length && !criteria.senders.length && !criteria.phrases.length) {
      // Fallback: the rules found nothing to filter on — let the LLM read the
      // request once. This can only ADD interpretation for queries the rules
      // can't parse; it never overrides an already-parsed query.
      try {
        const today = iso(new Date());
        const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `A restaurant manager typed this search into their email inbox in Relay: "${query}"

Today's date is ${today}. Turn the request into structured search criteria for finding emails Relay has imported.
- senders: any person, restaurant, company, or team name, or email address, the manager wants messages FROM (lowercase). "the Google Community Team message" → ["google community team"].
- keywords: distinctive words likely to appear in the message text, in lowercase, including obvious variants (e.g. a request also mentions "donate dinner", "fundraiser"). Expand an abbreviated or informal term into its likely full wording too (e.g. "dine & donate" also "dine and donate").
- phrases: exact phrases that must appear (lowercase), e.g. a program name.
- classifications / statuses / date_from / date_to: only when clearly implied. "last month" means the previous calendar month; "yesterday", "last week", "this week" resolved against today. Never guess a date range the manager did not imply.
Leave arrays empty and dates "" when not implied. Return JSON only.`,
          response_json_schema: CRITERIA_SCHEMA,
        });
        if (
          (llm.keywords || []).length || (llm.senders || []).length || (llm.phrases || []).length ||
          (llm.classifications || []).length || (llm.statuses || []).length || llm.date_from || llm.date_to
        ) {
          criteria = {
            senders: (llm.senders || []).map(lc).filter(Boolean),
            phrases: (llm.phrases || []).map(lc).filter(Boolean),
            keywords: (llm.keywords || []).map(lc).filter((t) => t.length > 1),
            statuses: (llm.statuses || []).map(lc).filter(Boolean),
            classifications: (llm.classifications || []).map(lc).filter(Boolean),
            date_from: llm.date_from || "",
            date_to: llm.date_to || "",
          };
          interpretedBy = "llm";
        }
      } catch (e) {
        // Keep the (empty) rules criteria — LLM is best-effort only.
      }
    }

    const senders = criteria.senders.map(lc).filter(Boolean);
    const phrases = criteria.phrases.map(lc).filter(Boolean);
    const keywords = criteria.keywords.map(lc).filter((t) => t.length > 1);
    const classifications = (criteria.classifications || []).map(lc).filter(Boolean);
    const statuses = criteria.statuses.map(lc).filter(Boolean);
    const dateFrom = criteria.date_from || "";
    const dateTo = criteria.date_to || "";

    // The manager's own words are required terms (every one must appear);
    // LLM-suggested words are variants (any one can match) — guesses never
    // narrow the manager's own criteria.
    const requireAllKeywords = interpretedBy === "rules";

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
      const intent = lc(c.intent);
      const category = lc(c.category);
      const opp = c.opportunity_id ? oppById[c.opportunity_id] : null;
      const oppTitle = lc(opp && opp.title);
      const haystack = `${subject} ${body} ${sender} ${intent} ${category} ${oppTitle}`;

      // Phrase variants ("dine & donate" / "dine and donate") are
      // alternatives — any one appearing is a match.
      if (phrases.length && !phrases.some((p) => haystack.includes(p))) continue;

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

      let matchedKeywords = 0;
      let score = 0;
      for (const k of keywords) {
        if (!haystack.includes(k)) continue;
        matchedKeywords++;
        if (subject.includes(k)) score += 30;
        if (oppTitle.includes(k)) score += 25;
        if (intent.includes(k) || category.includes(k)) score += 20;
        if (sender.includes(k)) score += 15;
        if (body.includes(k)) score += 10;
      }
      if (keywords.length) {
        if (requireAllKeywords) {
          if (matchedKeywords < keywords.length) continue;
        } else if (matchedKeywords === 0) {
          continue;
        }
      }
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
        by: interpretedBy,
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