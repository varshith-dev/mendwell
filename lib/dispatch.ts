import { haversineKm, DEFAULT_DETOUR, type LatLon } from "./geo";

export type Candidate = {
  id: string;
  lat: number;
  lon: number;
  /** Probability the pump is broken today (model prior updated by reports). */
  belief: number;
  /** People who use the pump. */
  served: number;
};

export type PlanParams = {
  depot: LatLon;
  shiftHours: number;
  speedKmh: number;
  detour: number;
  /** Time to arrive, look at the pump and talk to the users. */
  checkHours: number;
  /** Extra time when the pump is broken and gets repaired. */
  repairHours: number;
  /** Only consider pumps within this many km of the depot. */
  radiusKm: number;
  /** Optional parts budget: expected spend is belief * partsCost per stop. */
  partsBudget?: number;
  partsCost?: number;
};

export const DEFAULT_PARAMS: Omit<PlanParams, "depot"> = {
  shiftHours: 8,
  speedKmh: 20,
  detour: DEFAULT_DETOUR,
  checkHours: 0.3,
  repairHours: 1.5,
  radiusKm: 30,
  partsCost: 18,
};

export type Strategy = "planner" | "nearest" | "risk" | "random";

export type Stop = {
  id: string;
  legKm: number;
  legHours: number;
  arriveHours: number;
  departHours: number;
};

export type Plan = {
  strategy: Strategy;
  stops: Stop[];
  returnKm: number;
  totalKm: number;
  expectedHours: number;
  expectedRepairs: number;
  expectedPeople: number;
  expectedPartsCost: number;
};

type Node = Candidate & { value: number; service: number };

function legHours(a: LatLon, b: LatLon, p: PlanParams) {
  const km = haversineKm(a, b) * p.detour;
  return { km, h: km / p.speedKmh };
}

function toNode(c: Candidate, p: PlanParams): Node {
  return { ...c, value: c.belief * c.served, service: p.checkHours + c.belief * p.repairHours };
}

function prefilter(cands: Candidate[], p: PlanParams, cap = 450): Node[] {
  const out: (Node & { d: number })[] = [];
  for (const c of cands) {
    const d = haversineKm(p.depot, c) * p.detour;
    if (d <= p.radiusKm) out.push({ ...toNode(c, p), d });
  }
  out.sort((a, b) => b.value / (1 + b.d) - a.value / (1 + a.d));
  return out.slice(0, cap);
}

function routeHours(order: Node[], p: PlanParams): number {
  let t = 0;
  let prev: LatLon = p.depot;
  for (const n of order) {
    t += legHours(prev, n, p).h + n.service;
    prev = n;
  }
  return t + legHours(prev, p.depot, p).h;
}

function twoOpt(order: Node[], p: PlanParams): Node[] {
  let best = order.slice();
  let bestT = routeHours(best, p);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 30) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const cand = best.slice(0, i).concat(best.slice(i, j + 1).reverse(), best.slice(j + 1));
        const t = routeHours(cand, p);
        if (t + 1e-9 < bestT) {
          best = cand;
          bestT = t;
          improved = true;
        }
      }
    }
  }
  return best;
}

/**
 * Value-per-hour insertion heuristic for the orienteering problem.
 * value(pump) = P(broken) * people served = expected people whose water comes back if we go.
 * Repeatedly insert the pump with the best value per added hour, tidy the order with 2-opt,
 * and stop when nothing else fits in the shift (return trip included).
 */
function planValue(nodes: Node[], p: PlanParams): Node[] {
  let route: Node[] = [];
  const remaining = new Set(nodes);
  let budgetLeft = p.partsBudget ?? Infinity;
  const partsCost = p.partsCost ?? 0;
  for (let iter = 0; iter < 60; iter++) {
    const base = routeHours(route, p);
    let bestGain = 0;
    let bestN: Node | null = null;
    let bestPos = 0;
    for (const n of remaining) {
      if (n.belief * partsCost > budgetLeft) continue;
      for (let pos = 0; pos <= route.length; pos++) {
        const prev: LatLon = pos === 0 ? p.depot : route[pos - 1];
        const next: LatLon = pos === route.length ? p.depot : route[pos];
        const added =
          legHours(prev, n, p).h + legHours(n, next, p).h - legHours(prev, next, p).h + n.service;
        if (base + added > p.shiftHours) continue;
        const gain = n.value / Math.max(added, 0.02);
        if (gain > bestGain) {
          bestGain = gain;
          bestN = n;
          bestPos = pos;
        }
      }
    }
    if (!bestN) break;
    route = route.slice(0, bestPos).concat([bestN], route.slice(bestPos));
    remaining.delete(bestN);
    budgetLeft -= bestN.belief * partsCost;
    if (route.length >= 3) route = twoOpt(route, p);
  }
  return route;
}

function planNearest(nodes: Node[], p: PlanParams): Node[] {
  const left = nodes.slice();
  const route: Node[] = [];
  let here: LatLon = p.depot;
  while (left.length) {
    let bi = -1;
    let bd = Infinity;
    for (let i = 0; i < left.length; i++) {
      const d = haversineKm(here, left[i]);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    const n = left.splice(bi, 1)[0];
    if (routeHours(route.concat(n), p) > p.shiftHours) break;
    route.push(n);
    here = n;
  }
  return route;
}

function planRisk(nodes: Node[], p: PlanParams): Node[] {
  const sorted = nodes.slice().sort((a, b) => b.value - a.value);
  const route: Node[] = [];
  for (const n of sorted) {
    if (routeHours(route.concat(n), p) > p.shiftHours) break;
    route.push(n);
  }
  return route;
}

function planRandom(nodes: Node[], p: PlanParams, rng: () => number): Node[] {
  const sh = nodes.slice();
  for (let i = sh.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [sh[i], sh[j]] = [sh[j], sh[i]];
  }
  const route: Node[] = [];
  for (const n of sh) {
    if (routeHours(route.concat(n), p) > p.shiftHours) break;
    route.push(n);
  }
  return route;
}

export function planRoute(
  cands: Candidate[],
  params: PlanParams,
  strategy: Strategy = "planner",
  rng: () => number = Math.random,
): Plan {
  const nodes = prefilter(cands, params);
  const order =
    strategy === "planner"
      ? planValue(nodes, params)
      : strategy === "nearest"
        ? planNearest(nodes, params)
        : strategy === "risk"
          ? planRisk(nodes, params)
          : planRandom(nodes, params, rng);
  return describe(order, params, strategy);
}

function describe(order: Node[], p: PlanParams, strategy: Strategy): Plan {
  const stops: Stop[] = [];
  let t = 0;
  let km = 0;
  let prev: LatLon = p.depot;
  for (const n of order) {
    const leg = legHours(prev, n, p);
    t += leg.h;
    km += leg.km;
    const arrive = t;
    t += n.service;
    stops.push({ id: n.id, legKm: leg.km, legHours: leg.h, arriveHours: arrive, departHours: t });
    prev = n;
  }
  const back = legHours(prev, p.depot, p);
  return {
    strategy,
    stops,
    returnKm: back.km,
    totalKm: km + back.km,
    expectedHours: t + back.h,
    expectedRepairs: order.reduce((s, n) => s + n.belief, 0),
    expectedPeople: order.reduce((s, n) => s + n.value, 0),
    expectedPartsCost: order.reduce((s, n) => s + n.belief * (p.partsCost ?? 0), 0),
  };
}

/** Replay a plan against ground truth. Used by the backtest and by the technician demo. */
export function realize(
  plan: Plan,
  truth: Map<string, { broken: boolean; served: number; lat: number; lon: number }>,
  p: PlanParams,
) {
  let t = 0;
  let prev: LatLon = p.depot;
  let repairs = 0;
  let people = 0;
  let visited = 0;
  let km = 0;
  for (const s of plan.stops) {
    const n = truth.get(s.id)!;
    const leg = legHours(prev, n, p);
    const service = p.checkHours + (n.broken ? p.repairHours : 0);
    const back = legHours(n, p.depot, p).h;
    if (t + leg.h + service + back > p.shiftHours) break;
    t += leg.h + service;
    km += leg.km;
    visited++;
    if (n.broken) {
      repairs++;
      people += n.served;
    }
    prev = n;
  }
  return { visited, repairs, people, hours: t + legHours(prev, p.depot, p).h, km };
}
