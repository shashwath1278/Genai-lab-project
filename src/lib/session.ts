import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "ng_sid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Anonymous per-browser id for the plan board and query logs. Route handlers only. */
export async function getSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing && UUID.test(existing)) return existing;
  const sid = crypto.randomUUID();
  store.set(COOKIE, sid, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return sid;
}
