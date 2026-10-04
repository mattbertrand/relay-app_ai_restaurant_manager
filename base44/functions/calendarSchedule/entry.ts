import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { loadKnowledge } from "../../shared/restaurantKnowledge.ts";
import { calendarScheduleContext } from "../../shared/calendarSchedule.ts";

// The Today dashboard's Schedule section: connection state, today's events,
// and the 7-day summary, read from the manager's connected calendar. When no
// calendar is connected the response says so plainly — never a fake schedule.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const restaurantId = user.restaurant_id || (user.data && user.data.restaurant_id);
    let timezone = null;
    if (restaurantId) {
      const knowledge = await loadKnowledge(base44, restaurantId);
      timezone = knowledge ? knowledge.timezone : null;
    }

    const schedule = await calendarScheduleContext(base44, timezone);
    return Response.json(schedule);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}