// Publishes a manager-approved public response to a review.
//
// CRITICAL: Relay never publishes automatically — no background job, no
// schedule, no classification-triggered path reaches this function. It is
// invoked ONLY when the manager explicitly chooses "Publish response" in the
// UI, and it posts through the provider integration.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  providerFor,
  getGoogleConnection,
  googleUpsertReply,
} from "../../shared/reviewProviders.ts";

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
    const reviewId = payload.review_id;
    if (!reviewId) return Response.json({ error: 'A review is required.' }, { status: 400 });

    let review = null;
    try {
      review = await base44.entities.Review.get(reviewId);
    } catch (e) { /* not found */ }
    if (!review || review.restaurant_id !== restaurantId) {
      return Response.json({ error: 'Review not found.' }, { status: 404 });
    }

    const draft = (review.draft_response || '').trim();
    if (!draft) {
      return Response.json({ error: 'This review has no response draft to publish.' }, { status: 400 });
    }
    if (review.response_status === 'published') {
      return Response.json({ error: 'A response has already been published for this review.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const provider = providerFor(review.provider);
    const providerLabel = provider ? provider.label : review.provider;

    // Publishing attention work begins on the underlying matter, but never
    // resolves it — the manager may still need to investigate the issue.
    const statusPatch = review.manager_status === 'New' ? { manager_status: 'In Progress' } : {};

    // Demo reviews: the flow is exercised end-to-end, but nothing external is
    // contacted and the activity history says so plainly.
    if (review.is_demo || review.provider === 'demo') {
      await base44.entities.Review.update(review.id, {
        ...statusPatch,
        response_status: 'published',
        published_at: nowIso,
        publish_error: '',
      });
      await base44.entities.Activity.create({
        restaurant_id: restaurantId,
        review_id: review.id,
        type: 'review_response_published',
        description: `Response published (demo review — recorded in Relay only; no live connection).`,
        is_demo: true,
      });
      return Response.json({ published: true, demo: true, response_status: 'published' });
    }

    if (review.provider === 'google') {
      // Publishing to a live provider always requires an explicit confirmation
      // flag — the UI's confirmation dialog is the only caller that passes it.
      if (payload.confirm !== true) {
        return Response.json(
          { error: 'Publishing a public response requires explicit confirmation.' },
          { status: 400 }
        );
      }
      const connection = await getGoogleConnection(base44);
      if (!connection.connected) {
        await base44.entities.Review.update(review.id, {
          ...statusPatch,
          response_status: 'publication_failed',
          publish_error: connection.message,
        });
        await base44.entities.Activity.create({
          restaurant_id: restaurantId,
          review_id: review.id,
          type: 'review_response_publish_failed',
          description: `Response publication failed: ${connection.message}`,
          is_demo: false,
        });
        return Response.json({ published: false, error: connection.message, response_status: 'publication_failed' });
      }
      try {
        const reviewName = `${review.external_location_id}/reviews/${review.external_review_id}`;
        await googleUpsertReply(connection.accessToken, reviewName, draft);
        await base44.entities.Review.update(review.id, {
          ...statusPatch,
          response_status: 'published',
          published_at: nowIso,
          owner_response: draft,
          owner_response_at: nowIso,
          publish_error: '',
        });
        await base44.entities.Activity.create({
          restaurant_id: restaurantId,
          review_id: review.id,
          type: 'review_response_published',
          description: `Response published to ${providerLabel}.`,
          is_demo: false,
        });
        return Response.json({ published: true, response_status: 'published' });
      } catch (e) {
        await base44.entities.Review.update(review.id, {
          ...statusPatch,
          response_status: 'publication_failed',
          publish_error: e.message,
        });
        await base44.entities.Activity.create({
          restaurant_id: restaurantId,
          review_id: review.id,
          type: 'review_response_publish_failed',
          description: `Response publication failed: ${e.message}`,
          is_demo: false,
        });
        return Response.json({ published: false, error: e.message, response_status: 'publication_failed' });
      }
    }

    return Response.json({ error: `Provider "${review.provider}" does not support publishing yet.` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}