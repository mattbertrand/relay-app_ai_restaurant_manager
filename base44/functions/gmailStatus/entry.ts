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
    return Response.json({ connected: true, email });
  } catch (error) {
    return Response.json({ connected: false, error: error.message }, { status: 200 });
  }
}