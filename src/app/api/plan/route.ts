import { addPlanItems, deletePlanItem, listPlan, setPlanItemDone, type NewPlanItem } from "@/lib/plan";
import { getSessionId } from "@/lib/session";

export async function GET() {
  const sessionId = await getSessionId();
  return Response.json({ items: listPlan(sessionId) });
}

export async function POST(req: Request) {
  const { items } = (await req.json().catch(() => ({}))) as { items?: NewPlanItem[] };
  if (!Array.isArray(items) || !items.length) return Response.json({ error: "Expected { items: [...] }." }, { status: 400 });
  const sessionId = await getSessionId();
  const added = addPlanItems(sessionId, items);
  return Response.json({ added, items: listPlan(sessionId) });
}

export async function PATCH(req: Request) {
  const { id, done } = (await req.json().catch(() => ({}))) as { id?: number; done?: boolean };
  if (!Number.isInteger(id) || typeof done !== "boolean") return Response.json({ error: "Expected { id, done }." }, { status: 400 });
  const sessionId = await getSessionId();
  setPlanItemDone(sessionId, id!, done);
  return Response.json({ items: listPlan(sessionId) });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "Expected ?id=" }, { status: 400 });
  const sessionId = await getSessionId();
  deletePlanItem(sessionId, id);
  return Response.json({ items: listPlan(sessionId) });
}
