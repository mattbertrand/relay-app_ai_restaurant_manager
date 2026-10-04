import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Follow-up detection: called ONLY after the manager actually recorded a
// response (reply recorded, or an opportunity response approved) — never from
// an unapproved generated draft. When the recorded response commits to a
// future action ("I'll check with the kitchen and get back to you"), one
// Follow-up action is created so the promise is never forgotten. If the
// manager stated a date for the follow-up, it becomes the due date; otherwise
// the follow-up needs scheduling — no date is invented.

const COMMITMENT_HINT =
  /\b(get back|follow up|follow-up|check with|look into|i'?ll (confirm|check|find|let|reach|call|email)|let (you|them|him|her) know|circle back|report back|confirm (availability|with)|reach out (again|tomorrow|next)|will (confirm|check|follow))\b/i;

function plainText(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

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
    const conversationId = payload.conversation_id || "";
    const opportunityId = payload.opportunity_id || "";
    const replyText = plainText(payload.reply_text);
    if (!replyText) return Response.json({ created: false, reason: "no_reply_text" });

    // Cheap prefilter before any model call: no commitment language, no follow-up.
    if (!COMMITMENT_HINT.test(replyText)) {
      return Response.json({ created: false, reason: "no_commitment" });
    }

    // One pending follow-up per matter — recording another reply never stacks duplicates.
    const existing = await base44.entities.Action.filter(
      {
        restaurant_id: restaurantId,
        type: "Follow-up",
        status: "Pending Approval",
        ...(conversationId ? { conversation_id: conversationId } : { opportunity_id: opportunityId }),
      },
      null,
      1
    );
    if (existing.length) {
      return Response.json({ created: false, reason: "already_exists" });
    }

    const tz = payload.timezone || "America/Los_Angeles";
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `A restaurant manager just recorded this response to a customer email (subject: "${payload.subject || ""}", to: ${payload.customer_name || "the customer"}).

RECORDED RESPONSE:
"""
${replyText.slice(0, 3000)}
"""

Does the manager commit to a future follow-up action in this response — something the restaurant still needs to do and get back to the customer about (e.g. "I'll check with the kitchen and get back to you", "I'll confirm availability")? A response that fully answers the question with no promised future action is NOT a follow-up.

If it is a follow-up:
- task: a short imperative description of exactly what the manager promised to do (max 12 words, e.g. "Check with kitchen about private event menu").
- due_date: the date (YYYY-MM-DD) the manager said they would follow up by, ONLY if an explicit date or timeframe is stated (today is ${today}; resolve "tomorrow" or "end of the week" relative to it). Otherwise null — never invent a date.

Return JSON only.`,
      response_json_schema: {
        type: "object",
        properties: {
          is_follow_up: { type: "boolean" },
          task: { type: "string" },
          due_date: { type: "string", description: "YYYY-MM-DD when explicitly stated, otherwise null" },
        },
        required: ["is_follow_up", "task"],
      },
    });

    if (!result || !result.is_follow_up || !result.task) {
      return Response.json({ created: false, reason: "no_commitment" });
    }

    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(result.due_date || "")) ? result.due_date : null;

    const action = await base44.entities.Action.create({
      restaurant_id: restaurantId,
      conversation_id: conversationId,
      opportunity_id: opportunityId,
      type: "Follow-up",
      description: result.task,
      status: "Pending Approval",
      requires_approval: false,
      due_date: dueDate,
      is_demo: false,
    });

    await base44.entities.Activity.create({
      restaurant_id: restaurantId,
      opportunity_id: opportunityId,
      conversation_id: conversationId,
      type: "follow_up_scheduled",
      description: `Follow-up recorded from the manager's response: ${result.task}${dueDate ? ` — due ${dueDate}` : " (needs scheduling)"}`,
      is_demo: false,
    });

    return Response.json({ created: true, task: result.task, due_date: dueDate });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}