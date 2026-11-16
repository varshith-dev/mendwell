import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

// Tiny in-memory throttle: 8 attempts per minute per address.
const hits = new Map<string, number[]>();

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Enter an email and password." }, { status: 400 });
  const key = body.data.email.toLowerCase();
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 8) return NextResponse.json({ error: "Too many attempts. Wait a minute." }, { status: 429 });
  hits.set(key, [...recent, now]);

  const user = await db.user.findUnique({ where: { email: key } });
  if (!user || !(await bcrypt.compare(body.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "Email or password is wrong." }, { status: 401 });
  }
  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role as "officer" | "technician" });
  return NextResponse.json({ ok: true, role: user.role });
}
