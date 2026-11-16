import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decay, reportLogLR, type ReportKind } from "@/lib/risk";

/** Public: what the community page and the board's side panel show. No census status. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await db.pump.findUnique({
    where: { id: decodeURIComponent(id) },
    select: { id: true, country: true, lat: true, lon: true, adm1: true, adm2: true, adm3: true, tech: true, management: true, source: true, installYear: true, served: true, risk: true },
  });
  if (!p) return NextResponse.json({ error: "Pump not found" }, { status: 404 });
  const reports = await db.report.findMany({ where: { pumpId: p.id }, orderBy: { createdAt: "desc" }, take: 20, select: { kind: true, createdAt: true, simulated: true } });
  const now = Date.now();
  const detail = reports.map((r) => {
    const ageDays = (now - r.createdAt.getTime()) / 86_400_000;
    return { kind: r.kind, ageDays, simulated: r.simulated, weight: decay(ageDays), shift: reportLogLR(r.kind as ReportKind) * decay(ageDays) };
  });
  return NextResponse.json({ ...p, reports: detail });
}
