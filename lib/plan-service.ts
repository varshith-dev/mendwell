import { z } from "zod";
import { DEFAULT_PARAMS, planRoute, type Candidate, type Plan, type PlanParams } from "./dispatch";
import { getBeliefs } from "./data";
import type { Country } from "./countries";

export const PlanBody = z.object({
  country: z.enum(["sierra_leone", "uganda"]),
  depot: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }),
  shiftHours: z.number().min(2).max(12).default(DEFAULT_PARAMS.shiftHours),
  speedKmh: z.number().min(5).max(60).default(DEFAULT_PARAMS.speedKmh),
  radiusKm: z.number().min(3).max(80).default(DEFAULT_PARAMS.radiusKm),
  objective: z.enum(["people", "pumps"]).default("people"),
  partsBudget: z.number().min(0).max(5000).optional(),
});
export type PlanInput = z.infer<typeof PlanBody>;

export type StopView = {
  id: string; lat: number; lon: number; belief: number; prior: number; served: number;
  adm2: string; reports: number; legKm: number; arriveHours: number;
};

export type PlanResult = {
  input: PlanInput;
  params: PlanParams;
  planner: Plan & { stopViews: StopView[]; expectedPartsCost: number };
  baseline: Plan & { stopViews: StopView[] };
  candidates: number;
  prevalenceNote: string;
};

export async function runPlan(input: PlanInput): Promise<PlanResult> {
  const b = await getBeliefs(input.country as Country);
  const params: PlanParams = {
    ...DEFAULT_PARAMS,
    depot: input.depot,
    shiftHours: input.shiftHours,
    speedKmh: input.speedKmh,
    radiusKm: input.radiusKm,
    partsBudget: input.partsBudget,
  };
  const prev = b.prior.reduce((s, x) => s + x, 0) / b.prior.length;
  const real: Candidate[] = [];
  const blind: Candidate[] = [];
  const index = new Map<string, number>();
  // cheap bounding box prefilter before the exact radius filter in the planner
  const dLat = input.radiusKm / 111 + 0.05;
  const dLon = input.radiusKm / (111 * Math.max(0.2, Math.cos((input.depot.lat * Math.PI) / 180))) + 0.05;
  for (let i = 0; i < b.ids.length; i++) {
    if (Math.abs(b.lat[i] - input.depot.lat) > dLat || Math.abs(b.lon[i] - input.depot.lon) > dLon) continue;
    index.set(b.ids[i], i);
    const served = input.objective === "people" ? b.served[i] : 1;
    real.push({ id: b.ids[i], lat: b.lat[i], lon: b.lon[i], belief: b.belief[i], served });
    blind.push({ id: b.ids[i], lat: b.lat[i], lon: b.lon[i], belief: prev, served: 1 });
  }
  const planner = planRoute(real, params, "planner");
  const baseline = planRoute(blind, params, "nearest");

  const view = (plan: Plan): StopView[] =>
    plan.stops.map((s) => {
      const i = index.get(s.id)!;
      return { id: s.id, lat: b.lat[i], lon: b.lon[i], belief: b.belief[i], prior: b.prior[i], served: b.served[i], adm2: b.adm2[i], reports: b.reportCount[i], legKm: s.legKm, arriveHours: s.arriveHours };
    });
  // Score both on the same footing: our current belief and real people served.
  const score = (sv: StopView[]) => ({
    expectedRepairs: sv.reduce((s, x) => s + x.belief, 0),
    expectedPeople: sv.reduce((s, x) => s + x.belief * x.served, 0),
    expectedPartsCost: sv.reduce((s, x) => s + x.belief * (params.partsCost ?? 0), 0),
  });
  const pv = view(planner);
  const bv = view(baseline);
  return {
    input,
    params,
    planner: { ...planner, ...score(pv), stopViews: pv },
    baseline: { ...baseline, ...score(bv), stopViews: bv },
    candidates: real.length,
    prevalenceNote: `Without data a crew assumes every pump is equally likely to be broken (${Math.round(prev * 100)}% on average here).`,
  };
}
