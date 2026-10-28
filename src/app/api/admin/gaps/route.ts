import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { listGaps, setGapStatus } from "@/lib/gaps";

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  return Response.json({ gaps: listGaps() });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { id, status } = (await req.json().catch(() => ({}))) as { id?: number; status?: string };
  if (!Number.isInteger(id) || (status !== "open" && status !== "dismissed")) {
    return Response.json({ error: "Expected { id, status: 'open' | 'dismissed' }." }, { status: 400 });
  }
  setGapStatus(id!, status);
  return Response.json({ gaps: listGaps() });
}
