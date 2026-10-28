import { getDb } from "@/lib/db";
import { recordGap } from "@/lib/gaps";
import { getSessionId } from "@/lib/session";

export async function POST(req: Request) {
  const { queryId, value } = (await req.json().catch(() => ({}))) as { queryId?: number; value?: string };
  if (!Number.isInteger(queryId) || (value !== "up" && value !== "down")) {
    return Response.json({ error: "Expected { queryId, value: 'up' | 'down' }." }, { status: 400 });
  }
  const sessionId = await getSessionId();
  const { changes } = getDb().prepare("UPDATE queries SET feedback = ? WHERE id = ? AND session_id = ?").run(value, queryId, sessionId);
  if (!changes) return Response.json({ error: "Unknown question." }, { status: 404 });
  // A thumbs-down means the answer didn't help: surface it to staff as a gap.
  if (value === "down") recordGap(queryId!, "feedback");
  return Response.json({ ok: true });
}
