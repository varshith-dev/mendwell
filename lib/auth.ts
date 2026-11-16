import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

const COOKIE = "mendwell_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-only-secret-change-me-in-production-0000");

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
