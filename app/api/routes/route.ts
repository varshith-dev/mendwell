import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PlanBody, runPlan } from "@/lib/plan-service";

/** Save a plan as a technician route. The plan is recomputed here, never trusted from the client. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "officer") return NextResponse.json({ error: "Officer sign-in required." }, { status: 401 });
  const body = PlanBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad plan request" }, { status: 400 });
  const r = await runPlan(body.data);
  if (!r.planner.stops.length) return NextResponse.json({ error: "No pumps fit in that shift. Widen the radius." }, { status: 422 });
  const route = await db.route.create({
    data: {
      createdById: s.id,
      country: body.data.country,
      depotLat: body.data.depot.lat,
      depotLon: body.data.depot.lon,
      objective: body.data.objective,
      params: JSON.stringify(r.params),
      expectedRepairs: r.planner.expectedRepairs,
      expectedPeople: r.planner.expectedPeople,
      expectedHours: r.planner.expectedHours,
      totalKm: r.planner.totalKm,
      stops: {
        create: r.planner.stopViews.map((v, i) => ({ pumpId: v.id, seq: i + 1, legKm: v.legKm, arriveHours: v.arriveHours, belief: v.belief })),
      },
    },
  });
  return NextResponse.json({ id: route.id });
}
