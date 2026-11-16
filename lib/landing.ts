import fs from "node:fs";
import path from "node:path";
import { DEFAULT_PARAMS, planRoute } from "./dispatch";

type P = { id: string; country: string; lat: number; lon: number; served: number; risk: number };
let memo: ReturnType<typeof build> | null = null;

function build() {
  const all: P[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "points.json"), "utf8"));
  const sl = all.filter((p) => p.country === "sierra_leone");
  const depot = { lat: 7.9647, lon: -11.7383 };
  const box = { minLat: depot.lat - 0.05, maxLat: depot.lat + 0.05, minLon: depot.lon - 0.05 / Math.cos((depot.lat * Math.PI) / 180), maxLon: depot.lon + 0.05 / Math.cos((depot.lat * Math.PI) / 180) };
  const near = sl.filter((p) => p.lat >= box.minLat && p.lat <= box.maxLat && p.lon >= box.minLon && p.lon <= box.maxLon);
  const { minLat, maxLat, minLon, maxLon } = box;
  const cos = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const W = 520, H = 560, pad = 24;
  const k = Math.min((W - 2 * pad) / ((maxLon - minLon) * cos), (H - 2 * pad) / (maxLat - minLat));
  const px = (lon: number) => pad + (lon - minLon) * cos * k + (W - 2 * pad - (maxLon - minLon) * cos * k) / 2;
  const py = (lat: number) => pad + (maxLat - lat) * k + (H - 2 * pad - (maxLat - minLat) * k) / 2;
  const dots = near.map((p) => ({ x: +px(p.lon).toFixed(1), y: +py(p.lat).toFixed(1), r: +p.risk.toFixed(2) }));
  const plan = planRoute(near.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, served: p.served, belief: p.risk })), { ...DEFAULT_PARAMS, depot }, "planner");
  const byId = new Map(near.map((p) => [p.id, p]));
  const route = plan.stops.map((s) => {
    const p = byId.get(s.id)!;
    return { x: +px(p.lon).toFixed(1), y: +py(p.lat).toFixed(1) };
  });
  return { dots, route, depot: { x: +px(depot.lon).toFixed(1), y: +py(depot.lat).toFixed(1) }, W, H };
}

export function heroData() {
  return (memo ??= build());
}
