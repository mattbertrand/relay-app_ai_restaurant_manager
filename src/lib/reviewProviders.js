// Display metadata for review providers in the UI. The backend's provider
// registry (base44/shared/reviewProviders.ts) is authoritative — this only
// mirrors labels and availability for rendering. Future providers are listed
// as "Coming soon" and never render functional connect buttons.

export const PROVIDER_META = {
  google: {
    id: "google",
    label: "Google Business Profile",
    description: "Reviews left on your Google Business Profile.",
    status: "available",
  },
  demo: {
    id: "demo",
    label: "Demo Review Data",
    description: "Clearly labeled sample reviews to explore the full review workflow.",
    status: "available",
    isDemo: true,
  },
  yelp: { id: "yelp", label: "Yelp", description: "Coming soon.", status: "coming_soon" },
  tripadvisor: { id: "tripadvisor", label: "Tripadvisor", description: "Coming soon.", status: "coming_soon" },
  facebook: { id: "facebook", label: "Facebook", description: "Coming soon.", status: "coming_soon" },
};

export const UPCOMING_PROVIDERS = ["yelp", "tripadvisor", "facebook"];

// A demo source may simulate a live provider (demo_of_provider, e.g.
// "google"). It must always be labeled as demo and never shown as a live
// connection — the label reads "Google Business Profile — Demo".
export function sourceMetaFor(source) {
  if (source && source.is_demo && source.demo_of_provider && PROVIDER_META[source.demo_of_provider]) {
    const base = PROVIDER_META[source.demo_of_provider];
    return {
      ...base,
      label: `${base.label} — Demo`,
      description: "Simulated for Relay demonstration — not a live connection.",
      isDemo: true,
    };
  }
  return source && PROVIDER_META[source.provider] ? PROVIDER_META[source.provider] : PROVIDER_META.demo;
}