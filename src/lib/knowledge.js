// Default structure for the restaurant profile editor. Every section starts
// empty: Relay uses only what the manager actually enters — it never invents
// facts to fill a gap.

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function emptyHours() {
  const hours = {};
  for (const day of WEEKDAYS) {
    hours[day] = { open: "", close: "", closed: false };
  }
  return hours;
}

export function emptyVendor() {
  return {
    name: "",
    category: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    products_services: "",
    ordering_instructions: "",
    delivery_schedule: "",
    ordering_cutoff: "",
    status: "",
    escalation_contact: "",
    notes: "",
  };
}

export function emptyKnowledge() {
  return {
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    website: "",
    contact_email: "",
    hours: emptyHours(),
    temporary_hours: [],
    // Recurring special hours as recurrence rules with per-date exceptions —
    // occurrences are computed when needed, never materialized as records.
    recurring_special_hours: [],
    reservations: {
      accepted: false,
      method: "",
      phone: "",
      email: "",
      website: "",
      max_party_size: "",
      max_party_without_approval: "",
      large_party_policy: "",
      cancellation_policy: "",
      no_show_policy: "",
      deposit_policy: "",
      time_restrictions: "",
      other_rules: "",
    },
    private_events: {
      offered: false,
      min_capacity: "",
      max_capacity: "",
      event_types: "",
      private_dining_options: "",
      policies: "",
      booking_process: "",
      contact: "",
      pricing: "",
    },
    catering: {
      offered: false,
      types: "",
      min_guests: "",
      max_guests: "",
      service_area: "",
      policies: "",
      booking_process: "",
      contact: "",
      pricing: "",
    },
    happy_hour: {
      offered: false,
      days: "",
      start_time: "",
      end_time: "",
      details: "",
    },
    recurring_offerings: [],
    menu: {
      summary: "",
      vegetarian: false,
      vegan: false,
      gluten_free: false,
      kids_menu: false,
      takeout: false,
      delivery: false,
      gift_cards: false,
      loyalty_program: false,
      allergens: "",
      dietary_accommodations: "",
    },
    policies: {
      dress_code: "",
      pet_policy: "",
      parking: "",
      accessibility: "",
      outside_food_drinks: "",
      birthday_policy: "",
      cake_policy: "",
      decorations: "",
      age_restrictions: "",
      other: "",
    },
    other_info: "",
    // Draft signatures: a full one for email drafts, a separate shorter
    // public one for review responses.
    email_signature: "",
    // Rich signature: sanitized HTML (primary, used in email drafts) plus a
    // plain-text fallback kept in sync with email_signature.
    signature_html: "",
    signature_text: "",
    review_signature: "",
    // Restaurant-specific response templates — manager-defined guidance for
    // common inquiries. Relay recommends; it never sends or forwards.
    response_templates: [],
    // Optional review attention/response policy — foundation for
    // restaurant-specific review handling (e.g. Google vs Yelp).
    review_policy: {},
    // Administration areas — trusted context Relay uses to understand
    // employment, vendor, invoice, and operational communications. Structured
    // so new areas can be added safely later.
    hr: {
      hiring: false,
      positions_hiring: "",
      application_instructions: "",
      application_email: "",
      application_method: "",
      interview_process: "",
      hiring_contact: "",
      employee_inquiry_contact: "",
      hr_notes: "",
    },
    vendors: [],
    finance: {
      accounting_contact: "",
      invoice_contact: "",
      invoice_submission_procedure: "",
      payment_procedure: "",
      payment_approval_requirements: "",
      payment_deadlines: "",
      billing_email: "",
      finance_notes: "",
    },
    operations: {
      opening_procedures: "",
      closing_procedures: "",
      manager_responsibilities: "",
      recurring_duties: "",
      maintenance_contacts: "",
      equipment_contacts: "",
      cleaning_procedures: "",
      emergency_contacts: "",
      operational_policies: "",
      operations_notes: "",
    },
    marketing: {
      social_media: "",
      marketing_contact: "",
      current_promotions: "",
      recurring_promotions: "",
      brand_guidelines: "",
      marketing_notes: "",
    },
    // The restaurant's local timezone (IANA name) — displayed timestamps use it.
    timezone: "America/Los_Angeles",
  };
}

// Merges a stored profile record over the defaults so the editor always
// works with a complete structure, even for records saved by older versions.
export function knowledgeWithDefaults(record) {
  const base = emptyKnowledge();
  if (!record) return base;
  return {
    ...base,
    ...record,
    hours: { ...base.hours, ...(record.hours || {}) },
    temporary_hours: record.temporary_hours || [],
    recurring_special_hours: record.recurring_special_hours || [],
    reservations: { ...base.reservations, ...(record.reservations || {}) },
    private_events: { ...base.private_events, ...(record.private_events || {}) },
    catering: { ...base.catering, ...(record.catering || {}) },
    happy_hour: { ...base.happy_hour, ...(record.happy_hour || {}) },
    recurring_offerings: record.recurring_offerings || [],
    menu: { ...base.menu, ...(record.menu || {}) },
    policies: { ...base.policies, ...(record.policies || {}) },
    hr: { ...base.hr, ...(record.hr || {}) },
    vendors: record.vendors || [],
    finance: { ...base.finance, ...(record.finance || {}) },
    operations: { ...base.operations, ...(record.operations || {}) },
    marketing: { ...base.marketing, ...(record.marketing || {}) },
    response_templates: record.response_templates || [],
    review_policy: { ...base.review_policy, ...(record.review_policy || {}) },
  };
}

// A field counts as filled when the manager actually entered something.
// Booleans count only when true; arrays and objects when non-empty.
function isFilled(value) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    return Object.values(value).some(isFilled);
  }
  if (typeof value === "boolean") return value === true;
  return String(value).trim() !== "";
}

function pathValue(obj, path) {
  return path.reduce((o, key) => (o === undefined || o === null ? undefined : o[key]), obj);
}

// Lightweight, informational profile completeness per top-level group. It is
// never a requirement — an incomplete profile is perfectly usable; the
// indicator just shows the manager where more context would help Relay.
export function profileCompletion(profile) {
  if (!profile) return [];
  const groups = [
    {
      id: "restaurant",
      label: "Restaurant",
      paths: [
        ["address"], ["city"], ["state"], ["zip"], ["phone"], ["website"], ["contact_email"], ["hours"],
      ],
    },
    {
      id: "food",
      label: "Food & Beverage",
      paths: [
        ["menu", "summary"], ["menu", "allergens"], ["menu", "dietary_accommodations"],
        ["happy_hour", "details"], ["recurring_offerings"],
      ],
    },
    {
      id: "res_events",
      label: "Reservations & Events",
      paths: [
        ["reservations", "method"], ["reservations", "max_party_size"],
        ["reservations", "large_party_policy"], ["reservations", "cancellation_policy"],
        ["reservations", "deposit_policy"], ["private_events", "max_capacity"], ["catering", "contact"],
      ],
    },
    {
      id: "customers",
      label: "Customers",
      paths: [
        ["policies", "dress_code"], ["policies", "pet_policy"], ["policies", "parking"],
        ["policies", "accessibility"], ["policies", "birthday_policy"], ["policies", "other"], ["other_info"],
      ],
    },
    {
      id: "administration",
      label: "Administration",
      paths: [["hr"], ["vendors"], ["finance"], ["operations"], ["marketing"]],
    },
  ];
  return groups.map((g) => {
    const filled = g.paths.filter((p) => isFilled(pathValue(profile, p))).length;
    return {
      id: g.id,
      label: g.label,
      filled,
      total: g.paths.length,
      pct: Math.round((filled / g.paths.length) * 100),
    };
  });
}