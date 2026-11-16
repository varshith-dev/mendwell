import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { bustBeliefs } from "@/lib/data";

const Body = z.object({
  pumpId: z.string().min(3).max(40),
  kind: z.enum(["broken", "working", "low_flow"]),
  note: z.string().max(280).optional(),
  website: z.string().optional(), // honeypot: real people leave this empty
});

const seen = new Map<string, number[]>();

/** Public endpoint. No account needed: the person at the pump is the sensor. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad report" }, { status: 400 });
  if (body.data.website) return NextResponse.json({ ok: true }); // silently drop bots
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const key = `${ip}|${body.data.pumpId}`;
  const now = Date.now();
  const recent = (seen.get(key) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= 3) return NextResponse.json({ error: "You already reported this pump. Thank you." }, { status: 429 });
  seen.set(key, [...recent, now]);
  const pump = await db.pump.findUnique({ where: { id: body.data.pumpId }, select: { id: true } });
  if (!pump) return NextResponse.json({ error: "Unknown pump" }, { status: 404 });
  await db.report.create({ data: { pumpId: pump.id, kind: body.data.kind, note: body.data.note?.trim() || null, simulated: false } });
  bustBeliefs();
  return NextResponse.json({ ok: true });
}
