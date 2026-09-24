import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { GMAIL_CONNECTOR_ID } from "../../shared/gmailApi.ts";
import { reprocessConversations } from "../../shared/reprocessConversations.ts";

// Re-runs the current email analysis on live Gmail conversations that were
// classified by an earlier version of the classifier, and reconciles their
// opportunities. Kept separate from the sync so it can be run on demand.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const restaurantId = user.restaurant_id || (user.data && user.data.restaurant_id);
    if (!restaurantId) {
      return Response.json({ error: 'No restaurant is set up for this account yet.' }, { status: 400 });
    }

    try {
      await base44.asServiceRole.connectors.getCurrentAppUserConnection(GMAIL_CONNECTOR_ID);
    } catch (e) {
      return Response.json({ connected: false, error: 'Gmail is not connected.' }, { status: 200 });
    }

    const restaurant = await base44.entities.Restaurant.get(restaurantId);
    const [convos, messages] = await Promise.all([
      base44.entities.Conversation.filter({ restaurant_id: restaurantId }, null, 500),
      base44.entities.ConversationMessage.filter({ restaurant_id: restaurantId }, null, 500),
    ]);

    const summary = await reprocessConversations({
      base44,
      restaurantId,
      restaurantName: restaurant.name || 'the restaurant',
      convos,
      messages,
    });
    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}