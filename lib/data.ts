import { db } from "./db";
import { posterior, type ReportKind } from "./risk";

import { type Country } from "./countries";
export { COUNTRY_LABEL, COUNTRY_SURVEY } from "./countries";
export type { Country };

type Cache = { at: number; data: Beliefs };
export type Beliefs = {
  ids: string[];
  lat: number[];
  lon: number[];
  prior: number[];
  belief: number[];
  served: number[];
  adm1: string[];
  adm2: string[];
  reportCount: number[];
};
const cache = new Map<string, Cache>();

/** Invalidate after a new report so the board reflects it at once. */
export function bustBeliefs() {
  cache.clear();
}

/**
 * Today's belief per pump: model prior updated by community reports. The census status
 * (`broken`) is never selected here, so it cannot reach the planner or the browser.
 */
export async function getBeliefs(country: Country): Promise<Beliefs> {
  const hit = cache.get(country);
  if (hit && Date.now() - hit.at < 60_000) return hit.data;
  const pumps = await db.pump.findMany({
    where: { country },
    select: { id: true, lat: true, lon: true, risk: true, served: true, adm1: true, adm2: true },
    orderBy: { id: "asc" },
  });
  const reports = await db.report.findMany({
    where: { pump: { country } },
    select: { pumpId: true, kind: true, createdAt: true },
  });
  const now = Date.now();
  const byPump = new Map<string, { kind: ReportKind; ageDays: number }[]>();
  for (const r of reports) {
    const arr = byPump.get(r.pumpId) ?? [];
    arr.push({ kind: r.kind as ReportKind, ageDays: (now - r.createdAt.getTime()) / 86_400_000 });
    byPump.set(r.pumpId, arr);
  }
  const out: Beliefs = { ids: [], lat: [], lon: [], prior: [], belief: [], served: [], adm1: [], adm2: [], reportCount: [] };
  for (const p of pumps) {
    const rs = byPump.get(p.id) ?? [];
    out.ids.push(p.id);
    out.lat.push(p.lat);
    out.lon.push(p.lon);
    out.prior.push(p.risk);
    out.belief.push(posterior(p.risk, rs));
    out.served.push(p.served);
    out.adm1.push(p.adm1);
    out.adm2.push(p.adm2);
    out.reportCount.push(rs.length);
  }
  cache.set(country, { at: now, data: out });
  return out;
}

export type DistrictRow = {
  adm1: string;
  adm2: string;
  pumps: number;
  expectedBroken: number;
  peopleAtRisk: number;
  reported: number;
};

export function districtTable(b: Beliefs): DistrictRow[] {
  const m = new Map<string, DistrictRow>();
  for (let i = 0; i < b.ids.length; i++) {
    const k = `${b.adm1[i]}|${b.adm2[i]}`;
    const r = m.get(k) ?? { adm1: b.adm1[i], adm2: b.adm2[i], pumps: 0, expectedBroken: 0, peopleAtRisk: 0, reported: 0 };
    r.pumps++;
    r.expectedBroken += b.belief[i];
    r.peopleAtRisk += b.belief[i] * b.served[i];
    if (b.reportCount[i]) r.reported++;
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.peopleAtRisk - a.peopleAtRisk);
}
