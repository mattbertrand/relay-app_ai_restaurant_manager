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