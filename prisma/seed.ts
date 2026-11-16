import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_PARAMS, planRoute } from "../lib/dispatch";
import { posterior, type ReportKind } from "../lib/risk";

const prisma = new PrismaClient();

type P = {
  id: string; country: string; lat: number; lon: number; adm1: string; adm2: string; adm3: string | null;
  tech: string; management: string; source: string; installYear: number | null; served: number; broken: number; risk: number;
};
const SURVEY_YEAR: Record<string, number> = { sierra_leone: 2016, uganda: 2009 };

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const pts: P[] = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/points.json"), "utf8"));

  if (process.argv.includes("--if-empty")) {
    const [pumpCount, demoRoute] = await Promise.all([prisma.pump.count(), prisma.route.findUnique({ where: { id: "demo-route" } })]);
    if (pumpCount > 0 && demoRoute) {
      console.log(`already seeded (${pumpCount} pumps), skipping`);
      return;
    }
    if (pumpCount > 0) console.log("found an incomplete seed (no demo route), starting over");
  }
  console.log("seeding", pts.length, "pumps");

  await prisma.stop.deleteMany();
  await prisma.route.deleteMany();
  await prisma.report.deleteMany();
  await prisma.pump.deleteMany();
  await prisma.user.deleteMany();

  const officer = await prisma.user.create({
    data: { email: "officer@mendwell.demo", name: "Amara Kamara (demo officer)", role: "officer", passwordHash: await bcrypt.hash("mendwell-demo", 10) },
  });
  await prisma.user.create({
    data: { email: "tech@mendwell.demo", name: "Joseph Bangura (demo technician)", role: "technician", passwordHash: await bcrypt.hash("mendwell-demo", 10) },
  });

  for (let i = 0; i < pts.length; i += 1000) {
    await prisma.pump.createMany({
      data: pts.slice(i, i + 1000).map((p) => ({
        id: p.id, country: p.country, lat: p.lat, lon: p.lon, adm1: p.adm1, adm2: p.adm2, adm3: p.adm3,
        tech: p.tech, management: p.management, source: p.source, installYear: p.installYear,
        served: p.served, broken: !!p.broken, risk: p.risk, surveyYear: SURVEY_YEAR[p.country],
      })),
    });
  }

  // Simulated community reports (clearly flagged). 4% of pumps, each right 85% of the time.
  const rng = mulberry32(2026);
  const reports: { pumpId: string; kind: string; simulated: boolean; createdAt: Date }[] = [];
  const now = Date.now();
  for (const p of pts) {
    if (rng() > 0.04) continue;
    const right = rng() < 0.85;
    const truthBroken = !!p.broken;
    const saysBroken = right ? truthBroken : !truthBroken;
    const kind: ReportKind = saysBroken ? (rng() < 0.2 ? "low_flow" : "broken") : "working";
    reports.push({ pumpId: p.id, kind, simulated: true, createdAt: new Date(now - Math.floor(rng() * 20 * 86400_000)) });
  }
  for (let i = 0; i < reports.length; i += 1000) await prisma.report.createMany({ data: reports.slice(i, i + 1000) });
  console.log("simulated reports", reports.length);

  // A ready-made route so the technician view has something to show.
  const sl = await prisma.pump.findMany({ where: { country: "sierra_leone", adm2: "Bombali" } });
  const pool = sl.length > 50 ? sl : await prisma.pump.findMany({ where: { country: "sierra_leone" }, take: 3000 });
  const depot = { lat: pool[Math.floor(pool.length / 3)].lat, lon: pool[Math.floor(pool.length / 3)].lon };
  const repMap = new Map<string, { kind: ReportKind; ageDays: number }[]>();
  for (const r of reports) {
    const arr = repMap.get(r.pumpId) ?? [];
    arr.push({ kind: r.kind as ReportKind, ageDays: (now - r.createdAt.getTime()) / 86400_000 });
    repMap.set(r.pumpId, arr);
  }
  const params = { ...DEFAULT_PARAMS, depot };
  const plan = planRoute(
    pool.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, served: p.served, belief: posterior(p.risk, repMap.get(p.id) ?? []) })),
    params, "planner",
  );
  const beliefOf = new Map(pool.map((p) => [p.id, posterior(p.risk, repMap.get(p.id) ?? [])]));
  await prisma.route.create({
    data: {
      id: "demo-route", createdById: officer.id, country: "sierra_leone", depotLat: depot.lat, depotLon: depot.lon,
      objective: "people", params: JSON.stringify(params), expectedRepairs: plan.expectedRepairs,
      expectedPeople: plan.expectedPeople, expectedHours: plan.expectedHours, totalKm: plan.totalKm,
      stops: { create: plan.stops.map((s, i) => ({ pumpId: s.id, seq: i + 1, legKm: s.legKm, arriveHours: s.arriveHours, belief: beliefOf.get(s.id) ?? 0.3 })) },
    },
  });
  console.log("demo route stops", plan.stops.length);
}

main().finally(() => prisma.$disconnect());
