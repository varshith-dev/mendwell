import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RouteRunner } from "@/components/route/route-runner";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Route" };

export default async function RoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/route/${id}`);
  const route = await db.route.findUnique({
    where: { id },
    include: { stops: { orderBy: { seq: "asc" }, include: { pump: { select: { id: true, adm1: true, adm2: true, adm3: true, tech: true, installYear: true, served: true, lat: true, lon: true } } } } },
  });
  if (!route) notFound();
  return (
    <RouteRunner
      route={{ id: route.id, country: route.country, status: route.status, expectedPeople: route.expectedPeople, expectedRepairs: route.expectedRepairs, totalKm: route.totalKm, depotLat: route.depotLat, depotLon: route.depotLon }}
      stops={route.stops.map((s) => ({ id: s.id, seq: s.seq, legKm: s.legKm, arriveHours: s.arriveHours, belief: s.belief, outcome: s.outcome, note: s.note, pump: s.pump }))}
    />
  );
}
