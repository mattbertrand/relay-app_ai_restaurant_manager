import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { GMAIL_CONNECTOR_ID, getGmailProfile } from "../../shared/gmailApi.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let accessToken;
    try {
      ({ accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(GMAIL_CONNECTOR_ID));
    } catch (e) {
      return Response.json({ connected: false });
    }

    const email = await getGmailProfile(accessToken);

    // This restaurant's Gmail setup, including its initial email history
    // choice — shown for transparency. It controls the initial backfill only,
    // never ongoing monitoring.
    let gmailSetup = null;
    const restaurantId = user.restaurant_id || (user.data && user.data.restaurant_id);
    if (restaurantId) {
      try {
        const restaurant = await base44.entities.Restaurant.get(restaurantId);
        gmailSetup = (restaurant && restaurant.gmail_setup) || null;

        // An account connected before the initial-import setup existed may
        // already have imported email through normal syncing. The setup
        // questions are a first-connection step only — once this restaurant
        // has Gmail messages on record, the setup is marked complete here so
        // it is never asked again.
        if (!gmailSetup || !gmailSetup.completed_at) {
          const prior = await base44.entities.Conversation.filter(
            { restaurant_id: restaurantId, source: 'Gmail' },
            { limit: 1, fields: ['id'] }
          );
          if ((prior.items || prior).length > 0) {
            gmailSetup = {
              ...(gmailSetup || {}),
              window: gmailSetup?.window || 'completed',
              selected_at: gmailSetup?.selected_at || new Date().toISOString(),
              completed_at: new Date().toISOString(),
              prior_import: true,
            };
            await base44.entities.Restaurant.update(restaurantId, { gmail_setup: gmailSetup });
          }
        }
      } catch (e) { /* setup unknown */ }
    }

    // For the Communication page: whether the account has ever had an
    // explicit initial synchronization, when it last synced, and how many
    // Gmail messages Relay has imported.
    const initialized = !!(gmailSetup && gmailSetup.completed_at);
    let lastSyncedAt = null;
    let importedCount = null;
    if (initialized) {
      lastSyncedAt = gmailSetup.last_sync_at || gmailSetup.completed_at;
      try {
        importedCount = await base44.entities.Conversation.count({
          restaurant_id: restaurantId,
          source: 'Gmail',
          is_demo: false,
        });
      } catch (e) { /* count unavailable */ }
    }

    return Response.json({
      connected: true,
      email,
      gmail_setup: gmailSetup,
      initialized,
      last_synced_at: lastSyncedAt,
      imported_count: importedCount,
    });
  } catch (error) {
    return Response.json({ connected: false, error: error.message }, { status: 200 });
  }
}