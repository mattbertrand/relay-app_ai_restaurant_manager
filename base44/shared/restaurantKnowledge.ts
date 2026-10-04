// Loads and formats a restaurant's verified knowledge and the manager's past
// corrections for use during email analysis. Everything here is scoped to a
// single restaurant: one restaurant's knowledge and corrections never
// influence another restaurant's analysis.

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export async function loadKnowledge(base44, restaurantId) {
  const records = await base44.entities.RestaurantKnowledge.filter(
    { restaurant_id: restaurantId },
    null,
    5
  );
  const record = records[0] || null;
  if (record) {
    // The restaurant's structured menu items — imported from an uploaded menu
    // or the restaurant's website, or entered manually, and kept up to date by
    // the manager. Loaded alongside the profile so menu inquiries can be
    // answered from the actual menu.
    try {
      const page = await base44.entities.MenuItem.filter(
        { restaurant_id: restaurantId },
        { sort: "position", limit: 200 }
      );
      record.menu_items = page.items || [];
    } catch (e) {
      record.menu_items = [];
    }
  }
  return record;
}

export async function loadRecentFeedback(base44, restaurantId) {
  try {
    return await base44.entities.RestaurantFeedback.filter(
      { restaurant_id: restaurantId },
      "-created_date",
      15
    );
  } catch (e) {
    return [];
  }
}

function clean(value) {
  return value === undefined || value === null || value === "" ? null : value;
}

function line(label, value) {
  const v = clean(value);
  return v === null ? null : `${label}: ${v}`;
}

function yesNo(value) {
  return value === true || value === "true" ? "yes" : "no";
}

// Renders the restaurant's verified knowledge as compact prompt context.
// Returns null when nothing has been entered yet — the caller must then tell
// the model that no verified information exists so it never invents facts.
export function formatKnowledgeForPrompt(knowledge) {
  if (!knowledge) return null;
  const sections = [];

  const basic = [
    line("Address", [knowledge.address, knowledge.city, knowledge.state, knowledge.zip].filter(Boolean).join(", ")),
    line("Phone", knowledge.phone),
    line("Website", knowledge.website),
    line("General contact email", knowledge.contact_email),
  ].filter(Boolean);
  if (basic.length) sections.push(`BASIC INFORMATION\n${basic.join("\n")}`);

  const hours = knowledge.hours || {};
  const hourLines = [];
  for (const day of DAYS) {
    const h = hours[day];
    if (!h) continue;
    if (h.closed) {
      hourLines.push(`${day}: closed`);
    } else if (h.open || h.close) {
      hourLines.push(`${day}: ${h.open || "?"} – ${h.close || "?"}`);
    }
  }
  if (hourLines.length) sections.push(`OPERATING HOURS\n${hourLines.join("\n")}`);

  const temp = (knowledge.temporary_hours || [])
    .map((t) => {
      if (!t || (!t.label && !t.note)) return null;
      const dates =
        t.start_date || t.end_date
          ? ` (${t.start_date || "…"}${t.end_date ? " to " + t.end_date : ""})`
          : "";
      return `- ${t.label || "Special hours"}${dates}${t.note ? ": " + t.note : ""}`;
    })
    .filter(Boolean);
  if (temp.length) {
    sections.push(
      `TEMPORARY / SPECIAL HOURS (only use an item if today falls within its dates, or if it has no dates)\n${temp.join("\n")}`
    );
  }

  const r = knowledge.reservations || {};
  const resLines = [
    r.accepted === undefined || r.accepted === null ? null : `Reservations accepted: ${yesNo(r.accepted)}`,
    line("Reservation method", r.method),
    line("Reservation phone", r.phone),
    line("Reservation email", r.email),
    line("Reservation website/channel", r.website),
    line("Maximum standard party size", r.max_party_size),
    line("Maximum party size without manager approval", r.max_party_without_approval),
    line("Large-party policy", r.large_party_policy),
    line("Cancellation policy", r.cancellation_policy),
    line("No-show policy", r.no_show_policy),
    line("Deposit policy", r.deposit_policy),
    line("Reservation time restrictions", r.time_restrictions),
    line("Other reservation rules", r.other_rules),
  ].filter(Boolean);
  if (resLines.length) sections.push(`RESERVATIONS\n${resLines.join("\n")}`);

  const p = knowledge.private_events || {};
  const eventLines = [
    p.offered === undefined || p.offered === null ? null : `Private events offered: ${yesNo(p.offered)}`,
    line("Minimum capacity", p.min_capacity),
    line("Maximum capacity", p.max_capacity),
    line("Types of events accepted", p.event_types),
    line("Private dining options", p.private_dining_options),
    line("Event policies", p.policies),
    line("Booking process", p.booking_process),
    line("Event contact", p.contact),
    line("Pricing information", p.pricing),
  ].filter(Boolean);
  if (eventLines.length) sections.push(`PRIVATE EVENTS\n${eventLines.join("\n")}`);

  const c = knowledge.catering || {};
  const cateringLines = [
    c.offered === undefined || c.offered === null ? null : `Catering offered: ${yesNo(c.offered)}`,
    line("Types of catering", c.types),
    line("Minimum guest count", c.min_guests),
    line("Maximum guest count", c.max_guests),
    line("Service area", c.service_area),
    line("Catering policies", c.policies),
    line("Booking process", c.booking_process),
    line("Catering contact", c.contact),
    line("Pricing information", c.pricing),
  ].filter(Boolean);
  if (cateringLines.length) sections.push(`CATERING\n${cateringLines.join("\n")}`);

  const h = knowledge.happy_hour || {};
  const happyLines = [
    h.offered === undefined || h.offered === null ? null : `Happy hour offered: ${yesNo(h.offered)}`,
    line("Happy hour days", h.days),
    h.start_time || h.end_time ? line("Happy hour times", `${h.start_time || "?"} – ${h.end_time || "?"}`) : null,
    line("Happy hour details", h.details),
  ].filter(Boolean);
  if (happyLines.length) sections.push(`HAPPY HOUR\n${happyLines.join("\n")}`);

  const recurring = (knowledge.recurring_offerings || [])
    .map((o) => {
      if (!o || !o.name) return null;
      const when = [o.days, o.time].filter(Boolean).join(" ");
      return `- ${o.name}${when ? ` — ${when}` : ""}${o.details ? ` (${o.details})` : ""}`;
    })
    .filter(Boolean);
  if (recurring.length) sections.push(`RECURRING OFFERINGS\n${recurring.join("\n")}`);

  const m = knowledge.menu || {};
  const menuLines = [
    line("Menu summary", m.summary),
    m.vegetarian === undefined || m.vegetarian === null ? null : `Vegetarian options: ${yesNo(m.vegetarian)}`,
    m.vegan === undefined || m.vegan === null ? null : `Vegan options: ${yesNo(m.vegan)}`,
    m.gluten_free === undefined || m.gluten_free === null ? null : `Gluten-free options: ${yesNo(m.gluten_free)}`,
    m.kids_menu === undefined || m.kids_menu === null ? null : `Children's menu: ${yesNo(m.kids_menu)}`,
    m.takeout === undefined || m.takeout === null ? null : `Takeout: ${yesNo(m.takeout)}`,
    m.delivery === undefined || m.delivery === null ? null : `Delivery: ${yesNo(m.delivery)}`,
    m.gift_cards === undefined || m.gift_cards === null ? null : `Gift cards: ${yesNo(m.gift_cards)}`,
    m.loyalty_program === undefined || m.loyalty_program === null ? null : `Loyalty program: ${yesNo(m.loyalty_program)}`,
    line("Common allergens", m.allergens),
    line("Special dietary accommodations", m.dietary_accommodations),
  ].filter(Boolean);
  if (menuLines.length) sections.push(`MENU AND OFFERINGS\n${menuLines.join("\n")}`);

  // Structured menu items (imported from an uploaded menu or the restaurant's
  // website, or entered manually). Included whenever they exist so menu
  // questions can be answered from the actual menu rather than a summary.
  const menuItems = Array.isArray(knowledge.menu_items) ? knowledge.menu_items : [];
  if (menuItems.length) {
    const itemLines = menuItems
      .slice(0, 150)
      .map((it) => {
        if (!it || !it.name) return null;
        const bits = [
          it.section ? `[${it.section}]` : null,
          it.name,
          it.price ? `— ${it.price}` : null,
          it.description ? `: ${it.description}` : null,
          it.dietary ? `(dietary: ${it.dietary})` : null,
        ].filter(Boolean);
        return `- ${bits.join(" ")}`;
      })
      .filter(Boolean);
    if (itemLines.length) {
      const note = menuItems.length > 150 ? "\n(Menu list truncated — confirm less common items with the manager.)" : "";
      sections.push(
        `FULL MENU (verified menu items maintained by the manager — use these when answering menu questions)\n${itemLines.join("\n")}${note}`
      );
    }
  }

  const pol = knowledge.policies || {};
  const policyLines = [
    line("Dress code", pol.dress_code),
    line("Pet policy", pol.pet_policy),
    line("Parking", pol.parking),
    line("Accessibility", pol.accessibility),
    line("Outside food/drinks", pol.outside_food_drinks),
    line("Birthday policy", pol.birthday_policy),
    line("Cake policy", pol.cake_policy),
    line("Decorations", pol.decorations),
    line("Age restrictions", pol.age_restrictions),
    line("Other policies / FAQ answers", pol.other),
  ].filter(Boolean);
  if (policyLines.length) sections.push(`POLICIES AND FAQ\n${policyLines.join("\n")}`);

  if (knowledge.other_info) sections.push(`OTHER INFORMATION\n${knowledge.other_info}`);

  return sections.length ? sections.join("\n\n") : null;
}

const CORRECTION_PHRASES = {
  should_be_opportunity: "should have been classified as an Opportunity",
  should_be_attention: "should have been classified as Attention (customer intent worth a glance, but not an opportunity)",
  should_be_routine: "should have been classified as Routine (ordinary, no manager action needed)",
  should_be_administrative: "should have been classified as Administrative (e.g. job application, vendor, billing)",
  should_be_spam: "should have been classified as Spam",
};

// Renders the manager's past corrections as restaurant-specific guidance.
export function formatCorrectionsForPrompt(feedback) {
  if (!feedback || !feedback.length) return [];
  return feedback.map((f) => {
    const phrase = CORRECTION_PHRASES[f.correction] || f.correction;
    return `- For an email like "${f.subject || "(no subject)"}": the manager corrected that it ${phrase}${f.note ? ` — in the manager's words: "${f.note}"` : ""}`;
  });
}

// Renders the restaurant's active response templates as prompt context —
// restaurant-specific workflows for common inquiries (what Relay should ask,
// what it can answer immediately, and when to hand off to another person).
// Manager guidance only: templates never send or forward anything.
export function formatResponseTemplatesForPrompt(knowledge) {
  const templates = Array.isArray(knowledge && knowledge.response_templates)
    ? knowledge.response_templates.filter((t) => t && t.name && t.active !== false)
    : [];
  if (!templates.length) return null;
  const blocks = templates.map((t) => {
    const lines = [
      `TEMPLATE: ${t.name}`,
      t.inquiry_category ? `Inquiry type: ${t.inquiry_category}` : null,
      t.description ? `What it covers: ${clipped(t.description, 300)}` : null,
      t.when_to_use ? `When to use: ${clipped(t.when_to_use, 300)}` : null,
      t.response_guidance ? `Response guidance: ${clipped(t.response_guidance, 800)}` : null,
      t.info_to_collect ? `Information to collect from the customer: ${t.info_to_collect}` : null,
      t.recommended_next_action ? `Recommended next action: ${t.recommended_next_action}` : null,
      t.handoff_to
        ? `Handoff (recommend only, never forward automatically): ${t.handoff_to}${t.handoff_contact ? ` — contact: ${t.handoff_contact}` : ""}`
        : null,
    ].filter(Boolean);
    return lines.join("\n");
  });
  return blocks.join("\n\n");
}

// ---------------------------------------------------------------------------
// RESTAURANT PROFILE — Administration & Operations context
//
// The customer-facing knowledge above is always included. These administration
// areas (HR, vendors, finance, operations, marketing) are included ONLY when
// the message actually touches them, so prompts stay focused on the relevant
// context instead of dumping the whole profile into every email.
// ---------------------------------------------------------------------------

const HR_KEYWORDS =
  /\b(hir(e|es|ing)|job|jobs|opening|positions?|apply|application|resume|c\.?v\.?|interview|employment|employee|staff|work(ing)? (here|with you|for you)|shift)\b/i;
const VENDOR_KEYWORDS =
  /\b(vendors?|suppliers?|wholesale|purchase order|\bpo\b|deliver(y|ed|ies|ing)|shipment|shipped|order(ing|ed|s)?|invoice|billing|payment|remit(tance)?|past due|statement|supply|supplies|net \d+)\b/i;
const FINANCE_KEYWORDS =
  /\b(invoice|invoicing|billing|payment|remit(tance)?|past due|overdue|account statement|wire|ach|payment terms|net \d+|accounting|bookkeeping)\b/i;
const OPS_KEYWORDS =
  /\b(broke(n)? down|not working|equipment|walk-?in|cooler|freezer|oven|dishwasher|plumbing|leak|flood|maintenance|repair|out of order|power outage|emergency)\b/i;
const MARKETING_KEYWORDS =
  /\b(promotions?|promo code|social media|instagram|facebook|tiktok|sponsor(ship)?|press|advertisement|ad campaign|influencer|giveaway)\b/i;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function adminSectionFilled(obj) {
  if (!obj || typeof obj !== "object") return false;
  return Object.entries(obj).some(([k, v]) => {
    if (k === "hiring") return v === true || (v === false && Object.values(obj).some((x) => typeof x === "string" && x.trim()));
    if (typeof v === "boolean") return v === true;
    return typeof v === "string" ? v.trim() !== "" : v !== null && v !== undefined;
  });
}

function clipped(value, max = 400) {
  const s = String(value).trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// Selects the relevant administration section(s) of the Restaurant Profile
// for one incoming email, and returns them as compact verified context.
// Conservative: with no match, nothing is added — the analysis simply runs
// without administration context, exactly as it does today.
export function formatAdminContextForPrompt(knowledge, email = {}) {
  if (!knowledge) return null;
  const text = `${email.subject || ""}\n${email.body || ""}`;
  const senderEmail = (email.senderEmail || "").toLowerCase().trim();

  // A known vendor is matched by contact email (reliable) or by the vendor's
  // name appearing in the subject/body (fallback).
  const vendors = Array.isArray(knowledge.vendors) ? knowledge.vendors.filter(Boolean) : [];
  const matchedVendor = vendors.find(
    (v) =>
      (v.contact_email && senderEmail && String(v.contact_email).toLowerCase().trim() === senderEmail) ||
      (v.name && String(v.name).trim().length >= 4 &&
        new RegExp(`\\b${escapeRegExp(String(v.name).trim())}\\b`, "i").test(text))
  );

  const hrRelevant = adminSectionFilled(knowledge.hr) && HR_KEYWORDS.test(text);
  const vendorRelevant = vendors.length > 0 && (!!matchedVendor || VENDOR_KEYWORDS.test(text));
  const financeRelevant = adminSectionFilled(knowledge.finance) && (FINANCE_KEYWORDS.test(text) || !!matchedVendor);
  const opsRelevant = adminSectionFilled(knowledge.operations) && OPS_KEYWORDS.test(text);
  const marketingRelevant =
    adminSectionFilled(knowledge.marketing) && MARKETING_KEYWORDS.test(text);

  if (!hrRelevant && !vendorRelevant && !financeRelevant && !opsRelevant && !marketingRelevant) return null;

  const sections = [];

  if (hrRelevant) {
    const h = knowledge.hr;
    const hrLines = [
      h.hiring === true
        ? `Currently hiring: yes${h.positions_hiring ? ` — ${clipped(h.positions_hiring)}` : ""}`
        : h.hiring === false ? "Currently hiring: no" : null,
      h.hiring === true && h.positions_hiring ? null : line("Positions hiring", h.positions_hiring),
      line("How to apply", h.application_instructions),
      line("Application email", h.application_email),
      line("Application method", h.application_method),
      line("Interview process", h.interview_process),
      line("Hiring contact", h.hiring_contact),
      line("Employee inquiry contact", h.employee_inquiry_contact),
      line("HR notes", h.hr_notes),
    ].filter(Boolean);
    if (hrLines.length) sections.push(`HR / EMPLOYMENT (verified by the restaurant manager)\n${hrLines.join("\n")}`);
  }

  if (vendorRelevant) {
    const v = matchedVendor;
    if (v) {
      const vendorLines = [
        `Vendor: ${v.name}${v.category ? ` (${v.category})` : ""}${v.status ? ` — status: ${clipped(v.status)}` : ""}`,
        line("Contact", [v.contact_name, v.contact_email, v.contact_phone].filter(Boolean).join(", ")),
        line("Products/services supplied", v.products_services),
        line("Ordering instructions", v.ordering_instructions),
        line("Delivery schedule", v.delivery_schedule),
        line("Ordering cutoff", v.ordering_cutoff),
        line("Escalation contact", v.escalation_contact),
        line("Notes", v.notes),
      ].filter(Boolean);
      sections.push(`KNOWN VENDOR — THIS SENDER MATCHES A VERIFIED VENDOR (verified by the restaurant manager)\n${vendorLines.join("\n")}`);
    }
    const others = vendors.filter((x) => x !== v && x.name).map((x) => `${x.name}${x.category ? ` (${x.category})` : ""}`);
    if (others.length) {
      sections.push(`OTHER KNOWN VENDORS (verified): ${others.join("; ")}`);
    } else if (!v) {
      sections.push("KNOWN VENDORS (verified): The restaurant's vendor list contains no vendor matching this sender or subject.");
    }
  }

  if (financeRelevant) {
    const f = knowledge.finance;
    const financeLines = [
      line("Accounting contact", f.accounting_contact),
      line("Invoice contact", f.invoice_contact),
      line("Billing email", f.billing_email),
      line("Invoice submission procedure", f.invoice_submission_procedure),
      line("Payment procedure", f.payment_procedure),
      line("Payment approval requirements", f.payment_approval_requirements),
      line("Payment deadlines", f.payment_deadlines),
      line("Finance notes", f.finance_notes),
    ].filter(Boolean);
    if (financeLines.length) sections.push(`FINANCE / BILLING (verified by the restaurant manager)\n${financeLines.join("\n")}`);
  }

  if (opsRelevant) {
    const o = knowledge.operations;
    const opsLines = [
      line("Maintenance contacts", o.maintenance_contacts),
      line("Equipment contacts", o.equipment_contacts),
      line("Emergency contacts", o.emergency_contacts),
      line("Operational policies", o.operational_policies),
      line("Manager responsibilities", o.manager_responsibilities),
      line("Operations notes", o.operations_notes),
    ].filter(Boolean);
    if (opsLines.length) sections.push(`OPERATIONS (verified by the restaurant manager)\n${opsLines.join("\n")}`);
  }

  if (marketingRelevant) {
    const mk = knowledge.marketing;
    const mkLines = [
      line("Social media", mk.social_media),
      line("Marketing contact", mk.marketing_contact),
      line("Current promotions", mk.current_promotions),
      line("Recurring promotions", mk.recurring_promotions),
      line("Brand guidelines", mk.brand_guidelines),
      line("Marketing notes", mk.marketing_notes),
    ].filter(Boolean);
    if (mkLines.length) sections.push(`MARKETING (verified by the restaurant manager)\n${mkLines.join("\n")}`);
  }

  return sections.length ? sections.join("\n\n") : null;
}