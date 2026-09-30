import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { reanalyzeOne } from "../../shared/reanalyze.ts";

// Manager action: re-analyze one conversation with the CURRENT Restaurant
// Knowledge. Generates a fresh classification, reasoning, recommendation, and
// draft — never sends an email, and preserves the previous analysis.
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
    const conversationId = payload.conversation_id || '';
    const opportunityId = payload.opportunity_id || '';
    if (!conversationId && !opportunityId) {
      return Response.json({ error: 'Missing conversation or opportunity.' }, { status: 400 });
    }

    let convo = null;
    if (conversationId) {
      try {
        convo = await base44.entities.Conversation.get(conversationId);
      } catch (e) {
        convo = null;
      }
    } else {
      const linked = await base44.entities.Conversation.filter({ opportunity_id: opportunityId }, null, 5);
      convo = linked[0] || null;
    }
    if (!convo) return Response.json({ error: 'Conversation not found.' }, { status: 404 });
    if (convo.restaurant_id !== restaurantId) {
      return Response.json({ error: 'Conversation not found.' }, { status: 403 });
    }

    let restaurantName = 'the restaurant';
    try {
      const restaurant = await base44.entities.Restaurant.get(restaurantId);
      if (restaurant && restaurant.name) restaurantName = restaurant.name;
    } catch (e) {
      // fall back to the default name
    }

    const messages = await base44.entities.ConversationMessage.filter(
      { restaurant_id: restaurantId, conversation_id: convo.id },
      null,
      100
    );

    const result = await reanalyzeOne(base44, {
      restaurantId,
      restaurantName,
      convo,
      messages,
      confirm: payload.confirm === true,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}