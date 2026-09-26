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
  return records[0] || null;
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