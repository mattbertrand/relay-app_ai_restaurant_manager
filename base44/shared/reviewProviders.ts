// Provider-agnostic review source registry and provider implementations.
// A provider knows how to authenticate, list and normalize reviews, post a
// public response, and how long provider-controlled content may be retained.
// Adding Yelp / Tripadvisor / Facebook later means adding an entry here plus a
// normalizer — the sync, analysis, and attention pipeline stay untouched.

export const PROVIDERS = {
  google: {
    id: "google",
    label: "Google Business Profile",
    description: "Reviews left on the restaurant's Google Business Profile.",
    status: "available", // actionable in the UI
    // Expected OAuth scope once Google Business Profile API access is granted.
    // No additional scopes are requested beyond what the implemented
    // functionality needs.
    oauthScope: "https://www.googleapis.com/auth/business.manage",
    // Google API terms restrict how long provider content may be stored.
    // Keep this aligned with Google's CURRENT published policy — reviews are
    // re-retrieved from Google on every sync, and expired content is cleared.
    retentionDays: 30,
  },
  demo: {
    id: "demo",
    label: "Demo Review Data",
    description: "Clearly labeled sample reviews for demonstrating the review workflow.",
    status: "available",
    oauthScope: null,
    retentionDays: null, // demo data is not provider-controlled
    isDemo: true,
  },
  yelp: { id: "yelp", label: "Yelp", description: "Coming soon.", status: "coming_soon", oauthScope: null, retentionDays: 30 },
  tripadvisor: { id: "tripadvisor", label: "Tripadvisor", description: "Coming soon.", status: "coming_soon", oauthScope: null, retentionDays: 30 },
  facebook: { id: "facebook", label: "Facebook", description: "Coming soon.", status: "coming_soon", oauthScope: null, retentionDays: 30 },
};

export function providerFor(id) {
  return PROVIDERS[id] || null;
}

export function actionableProviderIds() {
  return Object.values(PROVIDERS).filter((p) => p.status === "available").map((p) => p.id);
}

// ---------------------------------------------------------------------------
// Google Business Profile provider
//
// OAuth architecture (server-side only — access tokens NEVER reach the
// client):
//   Connect Google Business Profile → Google authentication → Google consent
//   (scope: https://www.googleapis.com/auth/business.manage) → Relay
//   discovers authorized accounts and locations → the manager selects the
//   restaurant/location → Relay connects that location → review
//   synchronization begins.
//
// The platform's connector system provides server-side token storage and
// refresh handling. Until Google Business Profile API access and the OAuth
// configuration are available, getConnection() reports the honest state
// ("not configured") and no fake credentials, responses, or connections are
// ever produced.
// ---------------------------------------------------------------------------

export const GOOGLE_PROVIDER_ID = "google";
// The connector type the platform connector system will expose for Google
// Business Profile once configured. Resolved at runtime — never hardcoded
// credentials.
const GOOGLE_CONNECTOR_TYPE = "google_business";

export async function getGoogleConnection(base44) {
  try {
    const conn = await base44.asServiceRole.connectors.getCurrentAppUserConnection(GOOGLE_CONNECTOR_TYPE);
    if (conn && conn.accessToken) {
      return { connected: true, accessToken: conn.accessToken, connection: conn };
    }
    return {
      connected: false,
      reason: "not_connected",
      message: "Google Business Profile is not connected yet.",
    };
  } catch (e) {
    return {
      connected: false,
      reason: "not_configured",
      message:
        "Google Business Profile API access is not configured yet. Relay will connect here once Google API access and OAuth configuration are available.",
    };
  }
}

// Lists reviews for a location and returns provider data ready for
// normalization. Only reachable when a real, authorized connection exists.
export async function googleListReviews(accessToken, locationId, pageToken = null) {
  if (!accessToken) {
    const err = new Error("No authorized Google connection available.");
    err.code = "auth_required";
    throw err;
  }
  const url =
    `https://mybusiness.googleapis.com/v4/${encodeURIComponent(locationId)}/reviews` +
    (pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error("Google authorization has expired or been revoked — reconnect Google Business Profile.");
    err.code = "auth_expired";
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Google reviews request failed (${res.status}).`);
  }
  return res.json(); // { reviews: [...], nextPageToken, averageRating, totalReviewCount }
}

// Posts (creates or updates) the owner's public response to one review.
export async function googleUpsertReply(accessToken, reviewName, comment) {
  if (!accessToken) {
    const err = new Error("No authorized Google connection available.");
    err.code = "auth_required";
    throw err;
  }
  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${encodeURIComponent(reviewName)}/reply?updateMask=comment`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    }
  );
  if (res.status === 401 || res.status === 403) {
    const err = new Error("Google authorization has expired or been revoked — reconnect Google Business Profile.");
    err.code = "auth_expired";
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Google response publication failed (${res.status}).`);
  }
  return res.json();
}

// Normalizes one Google review object (v4 shape) into Relay's Review fields.
export function normalizeGoogleReview(source, r, nowIso) {
  const created = r.createTime || null;
  const reply = r.reviewReply || null;
  return {
    provider: "google",
    external_review_id: r.reviewId,
    external_location_id: source.provider_location_id || "",
    reviewer_name: (r.reviewer && r.reviewer.displayName) || "Google user",
    rating: typeof r.starRating === "string" ? ratingFromGoogleEnum(r.starRating) : r.starRating || null,
    review_text: r.comment || "",
    review_created_at: created,
    owner_response: reply ? reply.comment || "" : "",
    owner_response_at: reply ? reply.updateTime || null : null,
    source_url: null,
    first_seen_at: nowIso,
    last_synced_at: nowIso,
    is_demo: false,
  };
}

function ratingFromGoogleEnum(starRating) {
  const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[starRating] || null;
}

// When provider-controlled content must expire, per the source's provider.
export function expiresAtFor(providerId, syncedAtIso) {
  const provider = providerFor(providerId);
  if (!provider || !provider.retentionDays) return null;
  const ms = new Date(syncedAtIso).getTime() + provider.retentionDays * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}