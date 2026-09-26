// Default structure for the restaurant knowledge editor. Every section starts
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
  };
}

// Merges a stored knowledge record over the defaults so the editor always
// works with a complete structure, even for records saved by older versions.
export function knowledgeWithDefaults(record) {
  const base = emptyKnowledge();
  if (!record) return base;
  return {
    ...base,
    ...record,
    hours: { ...base.hours, ...(record.hours || {}) },
    temporary_hours: record.temporary_hours || [],
    reservations: { ...base.reservations, ...(record.reservations || {}) },
    private_events: { ...base.private_events, ...(record.private_events || {}) },
    catering: { ...base.catering, ...(record.catering || {}) },
    happy_hour: { ...base.happy_hour, ...(record.happy_hour || {}) },
    recurring_offerings: record.recurring_offerings || [],
    menu: { ...base.menu, ...(record.menu || {}) },
    policies: { ...base.policies, ...(record.policies || {}) },
  };
}