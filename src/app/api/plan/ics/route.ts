import { buildIcs } from "@/lib/ics";
import { listPlan } from "@/lib/plan";
import { getSessionId } from "@/lib/session";

export async function GET() {
  const sessionId = await getSessionId();
  const events = listPlan(sessionId)
    .filter((i) => i.dueDate && !i.done)
    .map((i) => ({ uid: `plan-${i.id}@northgate-copilot`, title: i.title, description: i.detail, date: i.dueDate! }));
  return new Response(buildIcs(events), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="northgate-plan.ics"',
    },
  });
}
