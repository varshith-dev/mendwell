import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("arrive") }),
  z.object({ action: z.literal("outcome"), outcome: z.enum(["fixed", "working", "needs_parts", "not_found"]), note: z.string().max(280).optional() }),
]);

/**
 * Technician actions. In this demo the pump's real condition is replayed from the national
 * census: it stays hidden until the technician taps "I'm here". In production that step is
 * simply the technician's own inspection.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const stop = await db.stop.findUnique({ where: { id }, include: { pump: { select: { broken: true, served: true, surveyYear: true } }, route: true } });
  if (!stop) return NextResponse.json({ error: "Stop not found" }, { status: 404 });

  if (body.data.action === "arrive") {
    await db.route.update({ where: { id: stop.routeId }, data: { status: "in_progress" } });
    return NextResponse.json({ broken: stop.pump.broken, served: stop.pump.served, replayedFrom: stop.pump.surveyYear });
  }
  const { outcome, note } = body.data;
  if (stop.pump.broken && outcome === "working") return NextResponse.json({ error: "This pump was found broken. Choose fixed, needs parts or not found." }, { status: 422 });
  if (!stop.pump.broken && (outcome === "fixed" || outcome === "needs_parts")) return NextResponse.json({ error: "This pump was found working." }, { status: 422 });
  await db.stop.update({ where: { id }, data: { outcome, note: note ?? null, visitedAt: new Date() } });
  const left = await db.stop.count({ where: { routeId: stop.routeId, outcome: null } });
  if (left === 0) await db.route.update({ where: { id: stop.routeId }, data: { status: "done" } });
  return NextResponse.json({ ok: true, routeDone: left === 0 });
}
