// Review source synchronization — provider-agnostic. Dispatches to the
// provider implementation, normalizes and upserts reviews (duplicate
// protection keyed on provider + external review ID), analyzes new reviews
// with the Restaurant Profile, updates Relay attention state, records sync
// status, and enforces provider content-retention rules.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  providerFor,
  getGoogleConnection,
  googleListReviews,
  normalizeGoogleReview,
  expiresAtFor,
} from "../../shared/reviewProviders.ts";
import {
  classifyReview,
  reviewUpdatesFor,
  REVIEW_CLASSIFICATION_LABELS,
} from "../../shared/reviewAnalysis.ts";
import {
  loadKnowledge,
  loadRecentFeedback,
  formatKnowledgeForPrompt,
} from "../../shared/restaurantKnowledge.ts";
import { buildDemoReviews } from "../../shared/reviewDemoData.ts";

// Bounded batch per run — the rest are picked up on the next sync.
const MAX_ANALYZE_PER_RUN = 10;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const restaurantId = user.restaurant_id || (user.data && user.data.restaurant_id);
    if (!restaurantId) {
      return Response.json({ error: 'No restaurant is set up for this account yet.' }, { status: 400 });
    }
    const restaurant = await base44.entities.Restaurant.get(restaurantId);
    const restaurantName = restaurant && restaurant.name ? restaurant.name : 'the restaurant';

    const [knowledgeRecord, feedback] = await Promise.all([
      loadKnowledge(base44, restaurantId),
      loadRecentFeedback(base44, restaurantId),
    ]);
    const analysisContext = {
      restaurantName,
      knowledgeContext: formatKnowledgeForPrompt(knowledgeRecord),
      timezone: knowledgeRecord ? knowledgeRecord.timezone : null,
    };

    // Provider content-retention enforcement runs on every sync.
    const summary = { expiredContent: await enforceRetention(base44, restaurantId, restaurantName), sources: [] };

    const payload = await req.json().catch(() => ({}));

    let sources;
    if (payload.source_id) {
      let source = null;
      try {
        source = await base44.entities.ReviewSource.get(payload.source_id);
      } catch (e) { /* not found */ }
      if (!source || source.restaurant_id !== restaurantId) {
        return Response.json({ error: 'Review source not found.' }, { status: 404 });
      }
      sources = [source];
    } else {
      sources = await base44.entities.ReviewSource.filter({ restaurant_id: restaurantId }, null, 10);
      // Explicit demo request (e.g. "Load demo reviews" in the UI) creates the
      // demo source on first use. Demo records are unmistakably labeled.
      if (payload.provider === 'demo' && !sources.some((s) => s.provider === 'demo')) {
        const created = await base44.entities.ReviewSource.create({
          restaurant_id: restaurantId,
          provider: 'demo',
          provider_location_name: 'Demo review data',
          connection_status: 'connected',
          connected_at: new Date().toISOString(),
          sync_status: 'idle',
          is_demo: true,
        });
        sources.push(created);
      }
    }

    if (payload.provider === 'google' && !sources.some((s) => s.provider === 'google')) {
      return Response.json({
        connected: false,
        error: 'Google Business Profile is not connected yet. Relay will connect once Google API access and OAuth configuration are available.',
      });
    }

    for (const source of sources) {
      const provider = providerFor(source.provider);
      if (!provider || provider.status !== 'available') continue;
      let result;
      if (source.provider === 'demo') {
        result = await syncDemoSource(base44, source, analysisContext);
      } else if (source.provider === 'google') {
        result = await syncGoogleSource(base44, source, analysisContext);
      } else {
        continue;
      }
      summary.sources.push(result);
    }

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Demo provider — clearly labeled sample data, never presented as live.
// ---------------------------------------------------------------------------
async function syncDemoSource(base44, source, ctx) {
  const nowIso = new Date().toISOString();
  await base44.entities.ReviewSource.update(source.id, {
    last_sync_attempt: nowIso,
    sync_status: 'in_progress',
    error_message: '',
  });
  const result = { source_id: source.id, provider: 'demo', connected: true, newReviews: 0, analyzed: 0, flagged: 0, draftsCreated: 0, error: null };
  try {
    const existing = await base44.entities.Review.filter(
      { restaurant_id: source.restaurant_id, provider: 'demo' },
      null,
      200
    );
    const byExternal = {};
    existing.forEach((r) => { if (r.external_review_id) byExternal[r.external_review_id] = r; });

    const newRecords = [];
    for (const d of buildDemoReviews()) {
      const found = byExternal[d.external_review_id];
      if (found) {
        // Re-sync refreshes provider-controlled fields (e.g. an owner response
        // appearing) and never creates a duplicate.
        const patch = { last_synced_at: nowIso };
        if ((d.owner_response || "") !== (found.owner_response || "")) {
          patch.owner_response = d.owner_response;
          patch.owner_response_at = d.owner_response_at;
        }
        await base44.entities.Review.update(found.id, patch);
        continue;
      }
      const created = await base44.entities.Review.create({
        restaurant_id: source.restaurant_id,
        review_source_id: source.id,
        provider: 'demo',
        external_review_id: d.external_review_id,
        external_location_id: '',
        reviewer_name: d.reviewer_name,
        rating: d.rating,
        review_text: d.review_text,
        review_created_at: d.review_created_at,
        source_url: d.source_url,
        owner_response: d.owner_response || '',
        owner_response_at: d.owner_response_at || null,
        classification: 'Routine',
        priority: 'informational',
        manager_status: 'New',
        response_status: 'no_response_needed',
        first_seen_at: nowIso,
        last_synced_at: nowIso,
        expires_at: expiresAtFor('demo', nowIso),
        is_demo: true,
      });
      newRecords.push(created);
      await base44.entities.Activity.create({
        restaurant_id: source.restaurant_id,
        review_id: created.id,
        type: 'review_received',
        description: `Review received: ${d.rating}★ from ${d.reviewer_name} (Demo review data)`,
        is_demo: true,
      });
      result.newReviews++;
    }

    const analysis = await analyzeNewReviews(base44, newRecords, ctx, true);
    result.analyzed = analysis.analyzed;
    result.flagged = analysis.flagged;
    result.draftsCreated = analysis.draftsCreated;
    result.classifications = analysis.classifications;

    await base44.entities.ReviewSource.update(source.id, {
      sync_status: 'idle',
      last_successful_sync: new Date().toISOString(),
      connection_status: 'connected',
    });
  } catch (e) {
    result.error = e.message;
    await base44.entities.ReviewSource.update(source.id, {
      sync_status: 'failed',
      error_message: e.message,
      last_sync_attempt: new Date().toISOString(),
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Google Business Profile provider — live sync path. Reachable only once
// Google Business Profile API access and OAuth configuration exist; until
// then the connection check reports the honest state and nothing is faked.
// ---------------------------------------------------------------------------
async function syncGoogleSource(base44, source, ctx) {
  const nowIso = new Date().toISOString();
  const connection = await getGoogleConnection(base44);
  if (!connection.connected) {
    await base44.entities.ReviewSource.update(source.id, {
      last_sync_attempt: nowIso,
      sync_status: 'failed',
      connection_status: connection.reason === 'not_connected' ? 'not_connected' : 'error',
      error_message: connection.message,
    });
    return { source_id: source.id, provider: 'google', connected: false, error: connection.message };
  }

  await base44.entities.ReviewSource.update(source.id, {
    last_sync_attempt: nowIso,
    sync_status: 'in_progress',
    error_message: '',
    connection_status: 'connected',
  });
  const result = { source_id: source.id, provider: 'google', connected: true, newReviews: 0, analyzed: 0, flagged: 0, draftsCreated: 0, error: null };
  try {
    const existing = await base44.entities.Review.filter(
      { restaurant_id: source.restaurant_id, provider: 'google' },
      null,
      200
    );
    const byExternal = {};
    existing.forEach((r) => { if (r.external_review_id) byExternal[r.external_review_id] = r; });

    const newRecords = [];
    let pageToken = null;
    let hasMore = true;
    while (hasMore) {
      const page = await googleListReviews(connection.accessToken, source.provider_location_id, pageToken);
      for (const r of page.reviews || []) {
        const normalized = normalizeGoogleReview(source, r, nowIso);
        const found = byExternal[normalized.external_review_id];
        if (found) {
          // Same review on a later sync: update provider-controlled fields
          // (edited text, new owner response) — never create a duplicate.
          const patch = { last_synced_at: nowIso };
          if (normalized.review_text !== found.review_text) patch.review_text = normalized.review_text;
          if ((normalized.owner_response || "") !== (found.owner_response || "")) {
            patch.owner_response = normalized.owner_response;
            patch.owner_response_at = normalized.owner_response_at;
          }
          await base44.entities.Review.update(found.id, patch);
          continue;
        }
        const created = await base44.entities.Review.create({
          restaurant_id: source.restaurant_id,
          review_source_id: source.id,
          provider: 'google',
          external_review_id: normalized.external_review_id,
          external_location_id: normalized.external_location_id,
          reviewer_name: normalized.reviewer_name,
          rating: normalized.rating,
          review_text: normalized.review_text,
          review_created_at: normalized.review_created_at,
          source_url: normalized.source_url,
          owner_response: normalized.owner_response,
          owner_response_at: normalized.owner_response_at,
          classification: 'Routine',
          priority: 'informational',
          manager_status: 'New',
          response_status: 'no_response_needed',
          first_seen_at: nowIso,
          last_synced_at: nowIso,
          expires_at: expiresAtFor('google', nowIso),
          is_demo: false,
        });
        newRecords.push(created);
        await base44.entities.Activity.create({
          restaurant_id: source.restaurant_id,
          review_id: created.id,
          type: 'review_received',
          description: `Review received: ${normalized.rating || '?'}★ from ${normalized.reviewer_name} (Google Business Profile)`,
          is_demo: false,
        });
        result.newReviews++;
      }
      pageToken = page.nextPageToken || null;
      hasMore = !!pageToken;
    }

    const analysis = await analyzeNewReviews(base44, newRecords, ctx, false);
    result.analyzed = analysis.analyzed;
    result.flagged = analysis.flagged;
    result.draftsCreated = analysis.draftsCreated;
    result.classifications = analysis.classifications;

    await base44.entities.ReviewSource.update(source.id, {
      sync_status: 'idle',
      last_successful_sync: new Date().toISOString(),
    });
  } catch (e) {
    result.error = e.message;
    const patch = {
      sync_status: 'failed',
      error_message: e.message,
      last_sync_attempt: new Date().toISOString(),
    };
    if (e.code === 'auth_expired' || e.code === 'auth_required') {
      // Expired/revoked credential handling: the source clearly shows the
      // broken state and the manager must reconnect.
      patch.connection_status = 'error';
    }
    await base44.entities.ReviewSource.update(source.id, patch);
  }
  return result;
}

// Analyzes newly imported reviews (bounded batch) and updates Relay's
// attention state + activity history. Never publishes anything.
async function analyzeNewReviews(base44, newRecords, ctx, isDemo) {
  const out = { analyzed: 0, flagged: 0, draftsCreated: 0, classifications: [] };
  for (const review of newRecords.slice(0, MAX_ANALYZE_PER_RUN)) {
    out.analyzed++;
    let analysis;
    try {
      analysis = await classifyReview(base44, ctx.restaurantName, review, {
        knowledgeContext: ctx.knowledgeContext,
        timezone: ctx.timezone,
      });
    } catch (e) {
      // Analysis failed — keep the review visible and say so plainly.
      await base44.entities.Review.update(review.id, {
        why_flagged: 'Analysis could not be completed for this review — please re-analyze.',
        last_analyzed_at: new Date().toISOString(),
      });
      out.classifications.push({ review_id: review.id, error: e.message });
      continue;
    }
    const updates = reviewUpdatesFor(analysis, review);
    await base44.entities.Review.update(review.id, updates);
    const label = REVIEW_CLASSIFICATION_LABELS[analysis.classification] || 'Routine';
    out.classifications.push({ review_id: review.id, classification: label, priority: updates.priority });
    await base44.entities.Activity.create({
      restaurant_id: review.restaurant_id,
      review_id: review.id,
      type: 'review_analyzed',
      description: `Review analyzed: classified as ${label}, priority ${updates.priority}${isDemo ? ' (demo)' : ''}.`,
      is_demo: isDemo,
    });
    if (analysis.classification === 'opportunity' || analysis.classification === 'attention') {
      out.flagged++;
      await base44.entities.Activity.create({
        restaurant_id: review.restaurant_id,
        review_id: review.id,
        type: 'review_flagged',
        description: `Relay flagged this review — ${String(analysis.why_flagged || '').slice(0, 200)}`,
        is_demo: isDemo,
      });
    }
    if (updates.draft_response) {
      out.draftsCreated++;
      await base44.entities.Activity.create({
        restaurant_id: review.restaurant_id,
        review_id: review.id,
        type: 'draft_prepared',
        description: `Draft public response created for ${review.reviewer_name}'s review${isDemo ? ' (demo)' : ''}.`,
        is_demo: isDemo,
      });
    }
  }
  return out;
}

// Provider content-retention enforcement: provider-controlled content is not
// stored beyond the provider's retention window. Durable operational metadata
// (classification, status, outcome) survives; full content is re-retrieved
// from the provider on the next sync. Never logged, never copied elsewhere.
async function enforceRetention(base44, restaurantId, restaurantName) {
  const nowIso = new Date().toISOString();
  let expiredCount = 0;
  for (const provider of ['google']) {
    const stale = await base44.entities.Review.filter(
      { restaurant_id: restaurantId, provider, content_expired: { $ne: true }, expires_at: { $ne: null, $lt: nowIso } },
      null,
      100
    );
    if (!stale.length) continue;
    await base44.entities.Review.bulkUpdate(
      stale.map((r) => ({
        id: r.id,
        content_expired: true,
        review_text: '',
        owner_response: '',
        source_url: '',
        reviewer_name: '',
      }))
    );
    for (const r of stale) {
      await base44.entities.Activity.create({
        restaurant_id: restaurantId,
        review_id: r.id,
        type: 'review_content_expired',
        description: "Google review content expired under Google's data-retention policy — it will be re-retrieved on the next sync.",
        is_demo: false,
      });
    }
    expiredCount += stale.length;
  }
  return expiredCount;
}