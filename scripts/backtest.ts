/**
 * Dispatch backtest on real survey outcomes.
 *
 * For each country we draw random depots, plan one 8 hour shift with each strategy using only
 * what a planner would know (the out-of-fold model risk, optionally plus community reports),
 * then replay the shift against the real census status of every visited pump.
 *
 * Run: npx tsx scripts/backtest.ts      Output: data/backtest.json
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_PARAMS, planRoute, realize, type Candidate, type PlanParams, type Strategy } from "../lib/dispatch";
import { posterior } from "../lib/risk";

type P = { id: string; country: string; lat: number; lon: number; served: number; broken: number; risk: number };
const pts: P[] = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/points.json"), "utf8"));

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

type Variant = { key: string; label: string; strategy: Strategy; unitWeight?: boolean; belief: (p: P, prev: number, rng: () => number, reported: Map<string, boolean>) => number };

const out: Record<string, unknown> = {
  generated_at: new Date().toISOString(),
  shift_hours: DEFAULT_PARAMS.shiftHours,
  assumptions: { ...DEFAULT_PARAMS, report_accuracy: 0.85, report_coverage: 0.05, note: "speed, check and repair times are assumptions, see sensitivity" },
  countries: {} as Record<string, unknown>,
};

for (const country of ["sierra_leone", "uganda"]) {
  const cp = pts.filter((p) => p.country === country);
  const prev = mean(cp.map((p) => p.broken));
  const rng = mulberry32(42);
  const truth = new Map(cp.map((p) => [p.id, { broken: !!p.broken, served: p.served, lat: p.lat, lon: p.lon }]));

  // Community reports: 5% of pumps have one report that is right 85% of the time.
  const reported = new Map<string, boolean>();
  for (const p of cp) if (rng() < 0.05) reported.set(p.id, rng() < 0.85 ? !!p.broken : !p.broken);

  const variants: Variant[] = [
    { key: "nearest", label: "Nearest pump first (no data)", strategy: "nearest", belief: () => prev },
    { key: "random", label: "Random order (no data)", strategy: "random", belief: () => prev },
    { key: "risk", label: "Highest risk first (model, ignores distance)", strategy: "risk", belief: (p) => p.risk },
    { key: "planner_noModel", label: "Planner without the model (people served only)", strategy: "planner", belief: () => prev },
    { key: "planner", label: "Mendwell planner (model risk)", strategy: "planner", belief: (p) => p.risk },
    { key: "planner_pumps", label: "Mendwell planner, objective = most pumps fixed", strategy: "planner", unitWeight: true, belief: (p) => p.risk },
    { key: "planner_pumps_noModel", label: "Planner (pumps objective) without the model", strategy: "planner", unitWeight: true, belief: () => prev },
    { key: "planner_reports", label: "Mendwell planner + community reports", strategy: "planner", belief: (p) => {
        const r = reported.get(p.id);
        return r === undefined ? p.risk : posterior(p.risk, [{ kind: r ? "broken" : "working", ageDays: 0 }]);
      } },
    { key: "oracle", label: "Upper bound: planner that knows every status", strategy: "planner", belief: (p) => (p.broken ? 0.98 : 0.02) },
  ];

  const results: Record<string, { repairs: number[]; people: number[]; visited: number[]; km: number[] }> = {};
  for (const v of variants) results[v.key] = { repairs: [], people: [], visited: [], km: [] };

  const N = 220;
  let done = 0;
  const seen = new Set<number>();
  while (done < N) {
    const i = Math.floor(rng() * cp.length);
    if (seen.has(i)) continue;
    seen.add(i);
    const depot = { lat: cp[i].lat, lon: cp[i].lon };
    const params: PlanParams = { ...DEFAULT_PARAMS, depot };
    // same candidate pool for every strategy
    const near = cp.filter((p) => Math.abs(p.lat - depot.lat) < 0.4 && Math.abs(p.lon - depot.lon) < 0.4);
    if (near.length < 15) continue;
    for (const v of variants) {
      const cands: Candidate[] = near.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, served: v.unitWeight ? 1 : p.served, belief: v.belief(p, prev, rng, reported) }));
      const plan = planRoute(cands, params, v.strategy, rng);
      const r = realize(plan, truth, params);
      results[v.key].repairs.push(r.repairs);
      results[v.key].people.push(r.people);
      results[v.key].visited.push(r.visited);
      results[v.key].km.push(r.km);
    }
    done++;
  }

  const summary: Record<string, unknown> = {};
  for (const v of variants) {
    const r = results[v.key];
    summary[v.key] = {
      label: v.label,
      pumps_visited: mean(r.visited),
      repairs_per_shift: mean(r.repairs),
      repairs_se: sd(r.repairs) / Math.sqrt(r.repairs.length),
      people_per_shift: mean(r.people),
      people_se: sd(r.people) / Math.sqrt(r.people.length),
      km_per_shift: mean(r.km),
    };
  }

  // Speed sensitivity for the two strategies that matter most.
  const sens: Record<string, { speed: number; planner: number; nearest: number }> = {};
  for (const speed of [12, 20, 30]) {
    const rr = mulberry32(99);
    const a: number[] = [], b: number[] = [];
    let d = 0;
    while (d < 80) {
      const i = Math.floor(rr() * cp.length);
      const depot = { lat: cp[i].lat, lon: cp[i].lon };
      const params: PlanParams = { ...DEFAULT_PARAMS, depot, speedKmh: speed };
      const near = cp.filter((p) => Math.abs(p.lat - depot.lat) < 0.4 && Math.abs(p.lon - depot.lon) < 0.4);
      if (near.length < 15) continue;
      const mk = (f: (p: P) => number): Candidate[] => near.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, served: p.served, belief: f(p) }));
      a.push(realize(planRoute(mk((p) => p.risk), params, "planner"), truth, params).repairs);
      b.push(realize(planRoute(mk(() => prev), params, "nearest"), truth, params).repairs);
      d++;
    }
    sens[speed] = { speed, planner: mean(a), nearest: mean(b) };
  }

  (out.countries as Record<string, unknown>)[country] = {
    depots_simulated: N,
    pumps: cp.length,
    base_rate: prev,
    reported_pumps: reported.size,
    variants: summary,
    speed_sensitivity: Object.values(sens),
  };
  console.log(country, JSON.stringify(summary, null, 1));
  console.log(country, "speed sensitivity", sens);
}
fs.writeFileSync(path.join(__dirname, "../data/backtest.json"), JSON.stringify(out, null, 1));
