// Task reminder + overdue check — invoked every 15 minutes by the Task
// Reminders workflow. Creates in-app notifications for reminders that have
// come due and marks overdue tasks ONCE (a task that stays overdue keeps its
// single overdue notification — reminders never become noise). Snoozed tasks
// stay quiet until the snooze passes.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

function todayIn(tz) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const restaurantId = user
      ? user.restaurant_id || (user.data && user.data.restaurant_id)
      : null;

    // The caller's restaurant when a user context is present; otherwise
    // (bare scheduled run) every restaurant with a profile.
    const restaurants = [];
    if (restaurantId) {
      restaurants.push({ id: restaurantId, tz: null });
    } else {
      const svc = base44.asServiceRole;
      const kPage = await svc.entities.RestaurantKnowledge.list({ limit: 100 });
      for (const k of kPage.items || []) restaurants.push({ id: k.restaurant_id, tz: k.timezone || null });
    }

    const nowIso = new Date().toISOString();
    const now = Date.now();
    let reminders = 0;
    let overdue = 0;

    for (const r of restaurants) {
      const svc = base44.asServiceRole;
      let tz = r.tz;
      if (!tz) {
        const k = await svc.entities.RestaurantKnowledge.filter({ restaurant_id: r.id }, null, 1);
        tz = (k.items && k.items[0] && k.items[0].timezone) || "America/Los_Angeles";
      }
      const today = todayIn(tz);

      const activePage = await svc.entities.Task.filter(
        { restaurant_id: r.id, status: { $in: ["Open", "In Progress"] } },
        { limit: 500 }
      );
      const active = (activePage.items || []).filter((t) => {
        if (!t.snooze_until) return true;
        const until = Date.parse(t.snooze_until);
        return !(until && until > now);
      });

      // 1. Reminders that have come due → one in-app notification each.
      //    Tasks already past due are handled by the overdue branch only —
      //    they get a single overdue notice, never both.
      const dueReminders = active.filter(
        (t) =>
          t.reminder_status === "pending" &&
          t.reminder_at &&
          t.reminder_at <= nowIso &&
          !(t.due_date && t.due_date < today)
      );
      const existingOf = (page) => (Array.isArray(page) ? page : page.items || []);
      for (const t of dueReminders) {
        const dup = existingOf(
          await svc.entities.Notification.filter(
            { restaurant_id: r.id, task_id: t.id, type: "task_reminder", due_at: t.reminder_at },
            { limit: 1 }
          )
        );
        if (!dup.length) {
          await svc.entities.Notification.create({
            restaurant_id: r.id,
            type: "task_reminder",
            title: "Reminder",
            body: t.title,
            task_id: t.id,
            task_title: t.title,
            due_at: t.reminder_at,
            delivery_channel: "in_app",
          });
          reminders++;
        }
        await svc.entities.Task.update(t.id, { reminder_status: "sent" });
      }

      // 2. Overdue → a single notification per task, ever. The Tasks page and
      //    Today keep showing the overdue state without new notifications.
      const overdueTasks = active.filter((t) => t.due_date && t.due_date < today);
      for (const t of overdueTasks) {
        const dup = existingOf(
          await svc.entities.Notification.filter(
            { restaurant_id: r.id, task_id: t.id, type: "task_overdue" },
            { limit: 1 }
          )
        );
        if (dup.length) continue;
        await svc.entities.Notification.create({
          restaurant_id: r.id,
          type: "task_overdue",
          title: "Task overdue",
          body: t.title,
          task_id: t.id,
          task_title: t.title,
          due_at: `${t.due_date}T12:00:00Z`,
          delivery_channel: "in_app",
        });
        // An overdue task's pending reminder is superseded by this notice.
        if (t.reminder_status === "pending") {
          await svc.entities.Task.update(t.id, { reminder_status: "sent" });
        }
        overdue++;
      }
    }

    return Response.json({ ok: true, reminders, overdue, restaurants: restaurants.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}