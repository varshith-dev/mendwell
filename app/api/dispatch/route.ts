import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { PlanBody, runPlan } from "@/lib/plan-service";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "officer") return NextResponse.json({ error: "Officer sign-in required." }, { status: 401 });
  const body = PlanBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad plan request", issues: body.error.issues }, { status: 400 });
  return NextResponse.json(await runPlan(body.data));
}
