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
      } catch (e) { /* setup unknown */ }
    }

    return Response.json({ connected: true, email, gmail_setup: gmailSetup });
  } catch (error) {
    return Response.json({ connected: false, error: error.message }, { status: 200 });
  }
}