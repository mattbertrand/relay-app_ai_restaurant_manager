// Manager-initiated re-analysis of one review using the current Restaurant
// Profile. Preserves the prior analysis for audit and never overwrites a
// manager-edited draft. Re-analysis never publishes anything.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
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
    if (review.content_expired) {
      return Response.json({ error: 'This review\'s content has expired under the provider\'s retention policy — run a sync to re-retrieve it.' }, { status: 400 });
    }

    const restaurant = await base44.entities.Restaurant.get(restaurantId);
    const restaurantName = restaurant && restaurant.name ? restaurant.name : 'the restaurant';

    // Snapshot the prior analysis so nothing is silently overwritten.
    const previous = [
      review.classification ? `Previously classified as ${review.classification}${review.category ? ` (${review.category})` : ''}, priority ${review.priority || 'unknown'}.` : null,
      review.why_flagged ? `Why flagged: ${review.why_flagged}` : null,
    ].filter(Boolean).join(' ');

    const [knowledgeRecord, feedback] = await Promise.all([
      loadKnowledge(base44, restaurantId),
      loadRecentFeedback(base44, restaurantId),
    ]);

    const analysis = await classifyReview(base44, restaurantName, review, {
      knowledgeContext: formatKnowledgeForPrompt(knowledgeRecord),
      timezone: knowledgeRecord ? knowledgeRecord.timezone : null,
      reviewSignature: knowledgeRecord && knowledgeRecord.review_signature ? knowledgeRecord.review_signature : null,
    });

    const updates = reviewUpdatesFor(analysis, review);
    if (previous) updates.previous_analysis = previous;
    await base44.entities.Review.update(review.id, updates);

    const label = REVIEW_CLASSIFICATION_LABELS[analysis.classification] || 'Routine';
    const classificationChanged = review.classification && review.classification !== label;
    await base44.entities.Activity.create({
      restaurant_id: restaurantId,
      review_id: review.id,
      type: classificationChanged ? 'classification_changed' : 'reanalyzed',
      description: classificationChanged
        ? `Re-analyzed with current Restaurant Profile — classification changed from ${review.classification} to ${label}.`
        : `Re-analyzed with current Restaurant Profile — classified as ${label}, priority ${updates.priority}.`,
      is_demo: review.is_demo,
    });

    return Response.json({
      classification: label,
      category: updates.category,
      priority: updates.priority,
      why_flagged: updates.why_flagged,
      knowledge_used: updates.knowledge_used,
      recommended_action: updates.recommended_action,
      draft_response: updates.draft_response !== undefined ? updates.draft_response : review.draft_response,
      previous_analysis: previous || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}