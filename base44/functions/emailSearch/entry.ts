import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Natural-language email search over the emails Relay has IMPORTED (New,
// Reply recorded, and Archived alike — Gmail itself is never queried here, so
// messages that were never imported can't be found and nothing is invented).
//
// v4 — hybrid search. Layer 1 (deterministic): quoted phrases, "from <name>"
// senders, status words, month names and relative dates are parsed IN CODE,
// so the same query always yields the same criteria. Filler words ("find",
// "all", "emails", "about", "show me") are instructions, never content.
// Layer 2 (matching): keywords match against raw AND normalized text
// ("Dine & Donate" ≈ "dine and donate"), singular/plural variants, a small
// synonym map, and word-boundary prefixes for distinctive names ("matt" ≈
// "matthieu") — no keyword must appear in any exact form. Layer 3 (ranking):
// strict pass first (every concept); when nothing matches, a relaxed pass
// ranks by however many concepts DO match, so a manager with partial
// information still gets the strongest results instead of zero. The LLM is
// only a last-resort fallback for queries the rules can't parse at all.
// Search is strictly read-only: it never creates or changes opportunities,
// drafts, or analysis.

const STOP_WORDS = new Set([
  "find", "the", "email", "emails", "message", "messages", "about", "from", "show", "me", "and",
  "with", "for", "that", "this", "please", "search", "look", "a", "an", "of", "in", "on", "my",
  "is", "are", "was", "were", "to", "at", "it", "its", "be", "has", "have", "had", "do", "does",
  "did", "i", "we", "they", "them", "their", "who", "what", "when", "where", "which", "how",
  "all", "any", "get", "by", "as", "or", "if", "so", "no", "not", "up", "regarding", "concerning",
  "recent", "hello", "hi",
]);

// Standalone month words become inclusive date ranges (current year). "May"
// is excluded on purpose — far too common as a plain word.
const MONTH_NAMES = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8,
  october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
};

// A small, careful synonym map — only terms where the equivalence is
// reliably true in restaurant email. Each keyword also gets
// singular/plural variants automatically.
const SYNONYMS = {
  invoice: ["invoices", "billing", "bill", "payment"],
  invoices: ["invoice", "billing", "bill", "payment"],
  billing: ["invoice", "invoices", "bill"],
  bill: ["invoice", "invoices", "billing"],
  fundraiser: ["fundraising", "fundraiser", "fund raiser"],
  fundraising: ["fundraiser", "fund raising"],
  reservation: ["reservations", "booking", "book"],
  reservations: ["reservation", "booking", "book"],
  reservation_request: ["reservation"],
  delivery: ["deliveries", "delivered"],
  deliveries: ["delivery", "delivered"],
  catering: ["caterer", "cater"],
  event: ["events"],
  events: ["event"],
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

// Normalized text: "&" reads as "and", punctuation collapses — so
// "Dine & Donate" matches "dine and donate" and "dine donate" queries.
const norm = (s) =>
  lc(s)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Singular/plural variants of a keyword.
function wordVariants(k) {
  const set = new Set([k]);
  if (k.endsWith("s") && k.length > 3) set.add(k.slice(0, -1));
  else set.add(k + "s");
  return [...set];
}

// Does this concept appear in the text at all — exact form, normalized form,
// a singular/plural variant, a mapped synonym, or (for distinctive words of
// 4+ letters, usually names) as a word-boundary prefix ("matt" → "matthieu")?
function termIn(term, raw, normalized) {
  const t = lc(term).trim();
  if (!t || t.length < 2) return false;
  if (raw.includes(t) || normalized.includes(norm(t))) return true;
  for (const v of wordVariants(t)) {
    if (raw.includes(v) || normalized.includes(norm(v))) return true;
  }
  for (const s of SYNONYMS[t] || []) {
    if (raw.includes(s) || normalized.includes(norm(s))) return true;
  }
  if (t.length >= 4) {
    const re = new RegExp(`\\b${escapeRe(t)}[a-z]*`);
    if (re.test(raw) || re.test(normalized)) return true;
  }
  return false;
}

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

  // "from <name>" — the name is the words after "from" up to the first
  // filler/stop word ("email from matt about dine and donate" → sender
  // "matt", topic "dine donate"). Max three words keeps multi-word names
  // ("banquet manager", "community team") while never swallowing the topic.
  const fromMatch = rest.match(/\bfrom\s+(.+)$/);
  if (fromMatch) {
    const afterFrom = fromMatch[1].trim().split(/[^a-z0-9'&.\-]+/).filter(Boolean);
    const nameWords = [];
    for (const w of afterFrom) {
      if (STOP_WORDS.has(w) || nameWords.length >= 3) break;
      nameWords.push(w);
    }
    if (nameWords.length) {
      criteria.senders.push(nameWords.join(" "));
      rest = rest.replace(
        new RegExp(`\\bfrom\\s+${nameWords.map(escapeRe).join("[^a-z0-9'&.\\-]+")}`, "g"),
        " "
      );
    }
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
    // Cross-field matching: subject / body / sender / intent / category /
    // linked-opportunity title, each against raw and normalized text.
    const contextOf = (c, opp) => {
      const subject = lc(c.subject);
      const body = lc(c.message);
      const sender = `${lc(c.customer_name)} ${lc(c.customer_email)}`;
      const intent = lc(c.intent);
      const category = lc(c.category);
      const oppTitle = lc(opp && opp.title);
      return {
        subject, body, sender, intent, category, oppTitle,
        raw: `${subject} ${body} ${sender} ${intent} ${category} ${oppTitle}`,
        normalized: norm(`${subject} ${body} ${sender} ${intent} ${category} ${oppTitle}`),
      };
    };

    // Scores one conversation against the parsed concepts and returns a
    // human explanation of what matched, or null when it doesn't qualify.
    // allKeywords: strict mode requires every keyword; relaxed mode ranks by
    // however many match.
    const scoreConversation = (c, opp, { allKeywords }) => {
      const ctx = contextOf(c, opp);

      // Phrase variants ("dine & donate" / "dine and donate") are
      // alternatives — any one appearing is a match.
      let matchedPhrase = null;
      if (phrases.length) {
        matchedPhrase = phrases.find((p) => termIn(p, ctx.raw, ctx.normalized));
        if (!matchedPhrase) return null;
      }

      // A sender the manager named matches either the From line or the name
      // signed in the message body — greetings and signatures often carry the
      // real person's name when the display name is an account holder's.
      let senderHit = null;
      let senderWhere = "";
      if (senders.length) {
        senderHit = senders.find((s) => termIn(s, `${ctx.sender}`, norm(ctx.sender)));
        if (senderHit) senderWhere = "from";
        else {
          senderHit = senders.find((s) => termIn(s, ctx.body, ctx.normalized));
          if (senderHit) senderWhere = "body";
        }
        if (!senderHit) return null;
      }

      if (statuses.length) {
        const st = lc(c.status);
        if (!statuses.some((s) => st === s || st.includes(s))) return null;
      }
      if (classifications.length) {
        const cls = lc(c.analysis_status);
        if (!classifications.some((x) => cls.includes(x))) return null;
      }

      const ts = c.received_at || c.created_date || "";
      if (dateFrom && ts && ts.slice(0, 10) < dateFrom) return null;
      if (dateTo && ts && ts.slice(0, 10) > dateTo) return null;

      const matched = [];
      let score = 0;
      let matchedKeywords = 0;
      for (const k of keywords) {
        if (ctx.subject.includes(k) || termIn(k, ctx.subject, norm(ctx.subject))) {
          matchedKeywords++; score += 30; matched.push(`Subject contains "${k}"`);
          continue;
        }
        if (ctx.oppTitle && termIn(k, ctx.oppTitle, norm(ctx.oppTitle))) {
          matchedKeywords++; score += 25; matched.push(`Opportunity "${(opp && opp.title) || ""}"`);
          continue;
        }
        if (termIn(k, `${ctx.intent} ${ctx.category}`, norm(`${ctx.intent} ${ctx.category}`))) {
          matchedKeywords++; score += 20; matched.push(`Topic: ${c.intent || c.category || k}`);
          continue;
        }
        if (termIn(k, ctx.sender, norm(ctx.sender))) {
          matchedKeywords++; score += 15; matched.push(`Sender mentions "${k}"`);
          continue;
        }
        if (termIn(k, ctx.body, ctx.normalized)) {
          matchedKeywords++; score += 10; matched.push(`Body contains "${k}"`);
        }
      }
      if (keywords.length) {
        if (allKeywords && matchedKeywords < keywords.length) return null;
        if (!allKeywords && matchedKeywords === 0 && !senderHit && !matchedPhrase) return null;
      }
      if (senderHit) {
        score += senderWhere === "from" ? 40 : 20;
        matched.unshift(
          senderWhere === "from"
            ? `Sender: ${c.customer_name || senders.join(", ")}`
            : `Named in message: ${senderHit}`
        );
      }
      if (matchedPhrase) {
        score += 25;
        matched.unshift(`Phrase: "${matchedPhrase}"`);
      }
      // Gentle recency tiebreak so equally relevant results read newest-first.
      const ageDays = ts ? (now - new Date(ts).getTime()) / 86400000 : 365;
      score += Math.max(0, 10 - Math.floor(ageDays / 30));

      return { c, score, opp, matched };
    };

    const runPass = (allKeywords) => {
      const scored = [];
      for (const c of convoPage.items || []) {
        const opp = c.opportunity_id ? oppById[c.opportunity_id] : null;
        const hit = scoreConversation(c, opp, { allKeywords });
        if (hit) scored.push(hit);
      }
      scored.sort((a, b) => b.score - a.score);
      return scored;
    };

    // Layer 3: strict pass (every keyword the manager typed), then — when
    // that finds nothing — a relaxed pass so partial information still
    // returns the strongest matches instead of zero results.
    let hits = runPass(true);
    let relaxed = false;
    if (!hits.length) {
      hits = runPass(false);
      relaxed = hits.length > 0;
    }

    const results = hits.slice(0, 20).map(({ c, opp, matched }) => ({
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
      matched,
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
      relaxed,
      searched: (convoPage.items || []).length,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}