import { clearMemory, deleteFact, listMemory, memoryEnabled, setMemoryEnabled } from "@/lib/memory";
import { getSessionId } from "@/lib/session";

// What the assistant remembers about this browser: list, forget one or all, switch off.

const state = (sessionId: string) => ({ enabled: memoryEnabled(sessionId), facts: listMemory(sessionId) });

export async function GET() {
  return Response.json(state(await getSessionId()));
}

export async function PATCH(req: Request) {
  const { enabled } = (await req.json().catch(() => ({}))) as { enabled?: unknown };
  if (typeof enabled !== "boolean") return Response.json({ error: "Expected { enabled: boolean }." }, { status: 400 });
  const sessionId = await getSessionId();
  setMemoryEnabled(sessionId, enabled);
  return Response.json(state(sessionId));
}

export async function DELETE(req: Request) {
  const params = new URL(req.url).searchParams;
  const sessionId = await getSessionId();
  if (params.get("all") === "1") clearMemory(sessionId);
  else {
    const id = Number(params.get("id"));
    if (!Number.isInteger(id)) return Response.json({ error: "Expected ?id= or ?all=1" }, { status: 400 });
    deleteFact(sessionId, id);
  }
  return Response.json(state(sessionId));
}
