"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, MapPin, Save, Target, Clock, Route as RouteIcon, Users, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Legend, PumpMap, type MapData, type PumpMapHandle } from "@/components/map/pump-map";

type StopView = { id: string; lat: number; lon: number; belief: number; prior: number; served: number; adm2: string; reports: number; legKm: number; arriveHours: number };
type PlanSide = { stopViews: StopView[]; expectedRepairs: number; expectedPeople: number; expectedHours: number; totalKm: number; expectedPartsCost: number };
type Result = { planner: PlanSide; baseline: PlanSide; candidates: number; prevalenceNote: string };
type Payload = MapData & { adm2: string[] };

const PRESETS: Record<string, { name: string; lat: number; lon: number }[]> = {
  sierra_leone: [
    { name: "Makeni", lat: 8.8806, lon: -12.0442 },
    { name: "Bo", lat: 7.9647, lon: -11.7383 },
    { name: "Kenema", lat: 7.8767, lon: -11.19 },
    { name: "Kabala", lat: 9.5871, lon: -11.5504 },
  ],
  uganda: [
    { name: "Gulu", lat: 2.7746, lon: 32.299 },
    { name: "Mbale", lat: 1.0821, lon: 34.1753 },
    { name: "Mbarara", lat: -0.6072, lon: 30.6545 },
    { name: "Lira", lat: 2.2499, lon: 32.8998 },
  ],
};

const hrs = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;
const fmt = (n: number) => (n >= 1e4 ? `${(n / 1e3).toFixed(1)}k` : Math.round(n).toLocaleString());
const pctMore = (a: number, b: number) => (b > 0 ? Math.round((a / b - 1) * 100) : 0);

export function Planner({ country: c0, lat, lon }: { country: string; lat?: number; lon?: number }) {
  const router = useRouter();
  const [country, setCountry] = useState(c0);
  const [data, setData] = useState<Payload | null>(null);
  const [depot, setDepot] = useState<{ lat: number; lon: number }>(lat != null && lon != null ? { lat, lon } : PRESETS[c0][0]);
  const [pick, setPick] = useState(false);
  const [shiftHours, setShift] = useState(8);
  const [speedKmh, setSpeed] = useState(20);
  const [radiusKm, setRadius] = useState(30);
  const [objective, setObjective] = useState<"people" | "pumps">("people");
  const [useBudget, setUseBudget] = useState(false);
  const [partsBudget, setBudget] = useState(60);
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const seq = useRef(0);
  const mapRef = useRef<PumpMapHandle>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    fetch(`/api/pumps?country=${country}`).then((r) => r.json()).then((j) => live && setData(j));
    return () => { live = false; };
  }, [country]);

  // Frame the circle the crew can reach whenever the start point or radius changes.
  useEffect(() => {
    if (!data) return;
    const dLat = (radiusKm * 1.15) / 111.32;
    const dLon = dLat / Math.cos((depot.lat * Math.PI) / 180);
    const t = setTimeout(() => mapRef.current?.fit({ minLat: depot.lat - dLat, maxLat: depot.lat + dLat, minLon: depot.lon - dLon, maxLon: depot.lon + dLon }), 60);
    return () => clearTimeout(t);
  }, [data, depot, radiusKm]);

  const body = useMemo(
    () => ({ country, depot, shiftHours, speedKmh, radiusKm, objective, ...(useBudget ? { partsBudget } : {}) }),
    [country, depot, shiftHours, speedKmh, radiusKm, objective, useBudget, partsBudget],
  );

  useEffect(() => {
    const id = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      const r = await fetch("/api/dispatch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (id !== seq.current) return;
      if (!r.ok) setErr(j.error ?? "Could not plan."); else { setErr(""); setRes(j); }
      setBusy(false);
    }, 300);
    return () => clearTimeout(t);
  }, [body]);

  const index = useMemo(() => {
    if (!data) return new Map<string, number>();
    return new Map(data.ids.map((id, i) => [id, i]));
  }, [data]);

  const save = useCallback(async () => {
    setSaving(true);
    const r = await fetch("/api/routes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Could not save."); setSaving(false); return; }
    router.push(`/route/${j.id}`);
  }, [body, router]);

  const stops = res?.planner.stopViews ?? [];
  const highlight = stops.map((s) => index.get(s.id)).filter((x): x is number => x != null);
  const pl = res?.planner, bl = res?.baseline;

  // Once a plan arrives, frame the route (and the grey baseline) so the stops are readable.
  useEffect(() => {
    if (!data || !res || !res.planner.stopViews.length) return;
    const ids = [...res.planner.stopViews, ...(res.baseline?.stopViews ?? [])].map((s) => index.get(s.id)).filter((x): x is number => x != null);
    if (!ids.length) return;
    let minLat = depot.lat, maxLat = depot.lat, minLon = depot.lon, maxLon = depot.lon;
    for (const i of ids) { minLat = Math.min(minLat, data.lat[i]); maxLat = Math.max(maxLat, data.lat[i]); minLon = Math.min(minLon, data.lon[i]); maxLon = Math.max(maxLon, data.lon[i]); }
    const padLat = Math.max(0.012, (maxLat - minLat) * 0.25), padLon = Math.max(0.012, (maxLon - minLon) * 0.25);
    const t = setTimeout(() => mapRef.current?.fit({ minLat: minLat - padLat, maxLat: maxLat + padLat, minLon: minLon - padLon, maxLon: maxLon + padLon }), 80);
    return () => clearTimeout(t);
  }, [res, data]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <div className="space-y-5">
      <div>
        <p className="label-mono">Dispatch · fig. 02</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">Plan one crew&apos;s day</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">Pick where the crew starts. Mendwell picks which pumps to visit, and in what order, to get water back for the most people before the shift ends.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
        {/* controls */}
        <section className="paper-card space-y-5 p-4" aria-label="Plan settings">
          <div>
            <p className="label-mono mb-2">Country</p>
            <div className="inline-flex w-full rounded-lg border border-rule bg-paper-2 p-0.5">
              {[["sierra_leone", "Sierra Leone"], ["uganda", "Uganda"]].map(([id, l]) => (
                <button key={id} onClick={() => { setCountry(id); setDepot(PRESETS[id][0]); setRes(null); }} className={`flex-1 rounded-md px-3 py-1.5 text-sm transition ${country === id ? "bg-ink text-paper" : "text-ink-2"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="label-mono mb-2">Crew starts at</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS[country].map((p) => (
                <button key={p.name} onClick={() => setDepot(p)} className={`rounded-full border px-3 py-1 text-sm transition ${Math.abs(depot.lat - p.lat) < 1e-4 && Math.abs(depot.lon - p.lon) < 1e-4 ? "border-ink bg-ink text-paper" : "border-rule hover:bg-paper-2"}`}>{p.name}</button>
              ))}
              <button onClick={() => setPick((v) => !v)} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition ${pick ? "border-signal bg-signal/10 text-signal" : "border-rule hover:bg-paper-2"}`}><MapPin className="size-3.5" />{pick ? "Tap the map…" : "Pick on map"}</button>
            </div>
            <p className="reading mt-2 text-[11px] text-ink-2">{depot.lat.toFixed(3)}, {depot.lon.toFixed(3)}</p>
          </div>
          <Field label="Shift length" value={`${shiftHours} h`}><Slider min={4} max={10} step={0.5} value={[shiftHours]} onValueChange={(v) => setShift(Array.isArray(v) ? v[0] : v)} aria-label="Shift length in hours" /></Field>
          <Field label="Average road speed" value={`${speedKmh} km/h`} hint="Rural tracks are slow. Assumption, not measured."><Slider min={8} max={40} step={1} value={[speedKmh]} onValueChange={(v) => setSpeed(Array.isArray(v) ? v[0] : v)} aria-label="Average road speed" /></Field>
          <Field label="Search radius" value={`${radiusKm} km`}><Slider min={8} max={60} step={1} value={[radiusKm]} onValueChange={(v) => setRadius(Array.isArray(v) ? v[0] : v)} aria-label="Search radius in kilometres" /></Field>
          <div>
            <p className="label-mono mb-2">Goal</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-rule bg-paper-2 p-0.5">
              {([["people", "Most people reached"], ["pumps", "Most pumps fixed"]] as const).map(([id, l]) => (
                <button key={id} onClick={() => setObjective(id)} className={`rounded-md px-2 py-1.5 text-[13px] leading-tight transition ${objective === id ? "bg-ink text-paper" : "text-ink-2"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center justify-between gap-3 text-sm"><span>Cap spare parts spend</span><Switch checked={useBudget} onCheckedChange={setUseBudget} aria-label="Cap spare parts spend" /></label>
            {useBudget && <Field label="Parts budget" value={`$${partsBudget}`} hint="Assumes about $18 of parts per broken pump."><Slider min={20} max={300} step={10} value={[partsBudget]} onValueChange={(v) => setBudget(Array.isArray(v) ? v[0] : v)} aria-label="Parts budget in US dollars" /></Field>}
          </div>
        </section>

        {/* map */}
        <section className="night-panel relative h-[60vh] min-h-[420px] overflow-hidden lg:h-[calc(100vh-14rem)] lg:min-h-[560px]" aria-label="Route map">
          {data ? (
            <PumpMap ref={mapRef} data={data} depot={depot} pickDepot={pick} radiusKm={radiusKm} className="absolute inset-0"
              onPickDepot={(p) => { setDepot(p); setPick(false); }}
              route={stops.map((s, i) => ({ lat: s.lat, lon: s.lon, n: i + 1 }))}
              baseline={bl?.stopViews.map((s) => ({ lat: s.lat, lon: s.lon }))}
              highlight={highlight} selected={sel != null ? index.get(stops[sel]?.id) ?? null : null}
              key={country} />
          ) : <div className="absolute inset-0 grid place-items-center text-sm text-[#d6e7ea]/70">Loading pumps…</div>}
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-col gap-1.5">
            <Legend />
            <span className="flex items-center gap-2 text-[10px] text-[#d6e7ea]/80"><span className="inline-block h-0.5 w-6 bg-[#9fe3f2]" /> Mendwell route <span className="ml-3 inline-block w-6 border-t border-dashed border-[#d6e7ea]/60" /> Nearest-first</span>
          </div>
          {busy && <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-md bg-[#0a1a21]/85 px-2.5 py-1.5 text-xs text-[#d6e7ea]"><Loader2 className="size-3.5 animate-spin" /> Planning…</div>}
        </section>

        {/* results */}
        <section className="space-y-3" aria-live="polite">
          {err && <p role="alert" className="rounded-md border border-signal/40 bg-signal/10 p-3 text-sm text-signal">{err}</p>}
          {pl && bl ? (
            <>
              <div className="paper-card p-4">
                <p className="label-mono">This crew, this shift</p>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4">
                  <Stat icon={<Users className="size-3.5" />} label="People reached" value={fmt(pl.expectedPeople)} delta={pctMore(pl.expectedPeople, bl.expectedPeople)} base={fmt(bl.expectedPeople)} />
                  <Stat icon={<Wrench className="size-3.5" />} label="Pumps fixed" value={pl.expectedRepairs.toFixed(1)} delta={pctMore(pl.expectedRepairs, bl.expectedRepairs)} base={bl.expectedRepairs.toFixed(1)} />
                  <Stat icon={<RouteIcon className="size-3.5" />} label="Distance" value={`${Math.round(pl.totalKm)} km`} base={`${Math.round(bl.totalKm)} km`} />
                  <Stat icon={<Clock className="size-3.5" />} label="Time used" value={hrs(pl.expectedHours)} base={hrs(bl.expectedHours)} />
                </div>
                <p className="mt-3 text-[11px] leading-snug text-ink-2">Expected values under today&apos;s beliefs. Grey figure is a crew that drives to the nearest pump each time with no data. {res?.prevalenceNote}</p>
                {useBudget && <p className="reading mt-2 text-xs">Parts: ~${Math.round(pl.expectedPartsCost)} of ${partsBudget}</p>}
              </div>
              <div className="paper-card p-2">
                <p className="label-mono px-2 pb-1 pt-2">Stops in order ({stops.length})</p>
                <ol className="max-h-[300px] space-y-0.5 overflow-y-auto pr-1">
                  {stops.map((s, i) => (
                    <motion.li key={s.id} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                      <button onClick={() => setSel(i)} className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition hover:bg-paper-2 ${sel === i ? "bg-paper-2" : ""}`}>
                        <span className="reading grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] text-paper">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{s.adm2} <span className="reading text-[11px] font-normal text-ink-2">{s.id}</span></span>
                          <span className="reading block text-[11px] text-ink-2">{Math.round(s.belief * 100)}% broken · {s.served.toLocaleString()} people · {s.legKm.toFixed(1)} km · {hrs(s.arriveHours)}{s.reports ? " · reported" : ""}</span>
                        </span>
                      </button>
                    </motion.li>
                  ))}
                  {!stops.length && <li className="px-2 py-4 text-sm text-ink-2">No pump fits in this shift. Try a wider radius or a longer shift.</li>}
                </ol>
              </div>
              <Button size="lg" className="h-10 w-full" onClick={save} disabled={saving || !stops.length}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Save and hand to a technician</Button>
            </>
          ) : (
            <div className="paper-card grid h-40 place-items-center text-sm text-ink-2"><Target className="mb-1 size-5" />Planning…</div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, hint, children }: { label: string; value: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between"><span className="label-mono">{label}</span><span className="reading text-sm">{value}</span></div>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-ink-2">{hint}</p>}
    </div>
  );
}

function Stat({ icon, label, value, base, delta }: { icon: React.ReactNode; label: string; value: string; base: string; delta?: number }) {
  return (
    <div>
      <p className="label-mono flex items-center gap-1.5">{icon}{label}</p>
      <p className="reading mt-1 text-2xl leading-none">{value}</p>
      <p className="reading mt-1 text-[11px] text-ink-2">
        {delta != null && delta !== 0 && <span className={delta > 0 ? "font-semibold text-moss" : "font-semibold text-signal"}>{delta > 0 ? "+" : ""}{delta}% </span>}
        vs {base}
      </p>
    </div>
  );
}
