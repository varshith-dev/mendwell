import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

const COOKIE = "mendwell_session";
// Demo deploy without manual env vars: when AUTH_SECRET is not set in production, derive a
// stable secret from the database URL (which only the project owns) plus a fixed salt.
// Fine for a demo with public demo accounts. Set AUTH_SECRET for anything real.
const secret = () => {
  let v = process.env.AUTH_SECRET;
  if (!v && process.env.NODE_ENV === "production") {
    const base = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!base) throw new Error("Set AUTH_SECRET or DATABASE_URL");
    v = createHash("sha256").update(`${base}|mendwell-demo-auth-salt-v1`).digest("hex");
  }
  return new TextEncoder().encode(v ?? "dev-only-secret-change-me-in-production-0000");
};

export type Session = { id: string; email: string; name: string; role: "officer" | "technician" };

export async function createSession(user: Session) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 86400 });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = await db.user.findUnique({ where: { id: String(payload.id) } });
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role as Session["role"] };
  } catch {
    return null;
  }
}

/** For pages: send signed-out visitors to the login page. */
export async function requireUser(next = "/board"): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(next)}`);
  return s;
}
