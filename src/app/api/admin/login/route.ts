import { adminLogin, adminPasscodeSet, isAdmin } from "@/lib/admin-auth";

export async function GET() {
  return Response.json({ required: adminPasscodeSet(), authed: await isAdmin() });
}

export async function POST(req: Request) {
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: string };
  const ok = await adminLogin(passcode ?? "");
  return ok ? Response.json({ ok: true }) : Response.json({ error: "Wrong passcode." }, { status: 401 });
}
