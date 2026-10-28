import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "ng_admin";

const token = (passcode: string) => crypto.createHash("sha256").update(`northgate-admin:${passcode}`).digest("hex");

export const adminPasscodeSet = () => !!process.env.ADMIN_PASSCODE;

/** With no ADMIN_PASSCODE configured the dashboard is open (local demo). */
export async function isAdmin(): Promise<boolean> {
  // Read cookies first even when open: it marks the route as request-time, so
  // admin GETs are never prerendered with build-time database contents.
  const store = await cookies();
  const passcode = process.env.ADMIN_PASSCODE;
  if (!passcode) return true;
  const value = store.get(COOKIE)?.value ?? "";
  const expected = token(passcode);
  return value.length === expected.length && crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export async function adminLogin(passcode: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected) return true;
  const a = Buffer.from(token(passcode));
  const b = Buffer.from(token(expected));
  if (!crypto.timingSafeEqual(a, b)) return false;
  (await cookies()).set(COOKIE, token(expected), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return true;
}

export function unauthorized() {
  return Response.json({ error: "Admin passcode required." }, { status: 401 });
}
