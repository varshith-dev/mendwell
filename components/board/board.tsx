"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Legend, PumpMap, type Box, type MapData, type PumpMapHandle } from "@/components/map/pump-map";
import { PumpPanel } from "./pump-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type District = { adm1: string; adm2: string; pumps: number; expectedBroken: number; peopleAtRisk: number; reported: number };
type Payload = MapData & { country: string; adm1: string[]; adm2: string[]; reports: number[]; districts: District[] };

const COUNTRIES = [
  { id: "sierra_leone", label: "Sierra Leone" },
  { id: "uganda", label: "Uganda" },
];
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : Math.round(n).toLocaleString());

export function Board({ initialCountry, initialPump }: { initialCountry: string; initialPump?: string }) {
  const router = useRouter();
  const [country, setCountry] = useState(initialCountry);
  const [data, setData] = useState<Payload | null>(null);
  const [region, setRegion] = useState("all");
  const [minBelief, setMinBelief] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState("districts");
  const map = useRef<PumpMapHandle>(null);

  useEffect(() => {
    let live = true;
    setData(null); setSelected(null); setRegion("all"); setMinBelief(0); setTab("districts");
    fetch(`/api/pumps?country=${country}`).then((r) => r.json()).then((j) => live && setData(j));
    return () => { live = false; };
  }, [country]);

  // Deep link: /board?pump=<id> opens that pump and zooms to it.
  useEffect(() => {
    if (!data || !initialPump) return;
    const i = data.ids.indexOf(initialPump);
    if (i < 0) return;
    setSelected(i); setTab("pump");
    const d = 0.02;
    setTimeout(() => map.current?.fit({ minLat: data.lat[i] - d, maxLat: data.lat[i] + d, minLon: data.lon[i] - d, maxLon: data.lon[i] + d } as Box), 120);
  }, [data, initialPump]);

  const regions = useMemo(() => (data ? [...new Set(data.adm1)].sort() : []), [data]);
  const mask = useMemo(() => {
    if (!data) return null;
    const m = new Uint8Array(data.ids.length);
    for (let i = 0; i < m.length; i++) m[i] = (region === "all" || data.adm1[i] === region) && data.belief[i] >= minBelief ? 1 : 0;
    return m;
  }, [data, region, minBelief]);

  const kpi = useMemo(() => {
    if (!data || !mask) return null;
    let n = 0, eb = 0, pr = 0, rep = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i]) { n++; eb += data.belief[i]; pr += data.belief[i] * data.served[i]; rep += data.reports[i] ? 1 : 0; }
    return { n, eb, pr, rep };
  }, [data, mask]);

  useEffect(() => { if (data && mask) map.current?.fit(); }, [region]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusDistrict = (d: District) => {
    if (!data) return;
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    for (let i = 0; i < data.ids.length; i++) if (data.adm2[i] === d.adm2 && data.adm1[i] === d.adm1) {
      minLat = Math.min(minLat, data.lat[i]); maxLat = Math.max(maxLat, data.lat[i]);
      minLon = Math.min(minLon, data.lon[i]); maxLon = Math.max(maxLon, data.lon[i]);
    }
    map.current?.fit({ minLat, maxLat, minLon, maxLon } as Box);
  };

  const visibleDistricts = data?.districts.filter((d) => region === "all" || d.adm1 === region).slice(0, 40) ?? [];
  const maxRisk = Math.max(1, ...visibleDistricts.map((d) => d.peopleAtRisk));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono">Board · fig. 01</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">Where is the water out?</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-2">Every dot is a hand pump. Colour is the chance it is broken today: the model&apos;s estimate, moved by what villagers report.</p>
        </div>
        <div role="tablist" aria-label="Country" className="inline-flex rounded-lg border border-rule bg-paper-2 p-0.5">
          {COUNTRIES.map((c) => (
            <button key={c.id} role="tab" aria-selected={country === c.id} onClick={() => setCountry(c.id)}
              className={`rounded-md px-3.5 py-1.5 text-sm transition ${country === c.id ? "bg-ink text-paper shadow" : "text-ink-2 hover:text-ink"}`}>{c.label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pumps in view" value={kpi ? kpi.n.toLocaleString() : "…"} />
        <Kpi label="Expected broken today" value={kpi ? fmt(kpi.eb) : "…"} tone="signal" />
        <Kpi label="People behind those pumps" value={kpi ? fmt(kpi.pr) : "…"} tone="signal" />
        <Kpi label="Pumps with a recent report" value={kpi ? kpi.rep.toLocaleString() : "…"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="night-panel relative h-[62vh] min-h-[420px] overflow-hidden lg:h-[calc(100vh-17rem)] lg:min-h-[520px]">
          {data ? (
            <PumpMap ref={map} data={data} mask={mask} selected={selected} className="absolute inset-0"
              onSelect={(i) => { setSelected(i); if (i != null) setTab("pump"); }} />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-sm text-[#d6e7ea]/70">Loading pumps…</div>
          )}
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-2">
            <div className="pointer-events-auto rounded-lg border border-white/10 bg-[#0a1a21]/80 p-2.5 backdrop-blur">
              <label className="label-mono !text-[#d6e7ea]/70" htmlFor="region">Region</label>
              <select id="region" value={region} onChange={(e) => setRegion(e.target.value)}
                className="mt-1 block w-44 rounded-md border border-white/15 bg-[#12303b] px-2 py-1.5 text-sm text-[#e9fbff] outline-none focus-visible:ring-2 focus-visible:ring-[#9fe3f2]">
                <option value="all">All regions</option>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <div className="label-mono mt-3 flex justify-between !text-[#d6e7ea]/70"><span>Hide below</span><span className="reading !text-[#e9fbff]">{Math.round(minBelief * 100)}%</span></div>
              <Slider className="mt-2 w-44" min={0} max={0.7} step={0.05} value={[minBelief]} onValueChange={(v) => setMinBelief(Array.isArray(v) ? v[0] : v)} aria-label="Hide pumps below this chance of being broken" />
            </div>
          </div>
          <Legend className="pointer-events-none absolute bottom-3 left-3 z-10" />
        </div>

        <aside className="paper-card min-h-[320px] p-4 lg:max-h-[calc(100vh-17rem)] lg:overflow-y-auto">
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList>
              <TabsTrigger value="districts">Where to send crews</TabsTrigger>
              <TabsTrigger value="pump" disabled={selected == null}>Pump</TabsTrigger>
            </TabsList>
            <TabsContent value="districts" className="mt-3">
              <p className="mb-3 text-xs text-ink-2">Districts ranked by people behind pumps that are probably broken. Tap one to zoom.</p>
              <ol className="space-y-1">
                {visibleDistricts.map((d, i) => (
                  <li key={d.adm1 + d.adm2}>
                    <button onClick={() => focusDistrict(d)} className="group w-full rounded-md px-2 py-2 text-left transition hover:bg-paper-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium"><span className="reading mr-2 text-xs text-ink-2">{String(i + 1).padStart(2, "0")}</span>{d.adm2}</span>
                        <span className="reading text-xs text-ink-2">{fmt(d.peopleAtRisk)} people</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-2">
                        <motion.div className="h-full rounded-full bg-signal" initial={{ width: 0 }} animate={{ width: `${(d.peopleAtRisk / maxRisk) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.015 }} />
                      </div>
                      <div className="reading mt-1 text-[10px] text-ink-2">{d.adm1} · {d.pumps.toLocaleString()} pumps · ~{Math.round(d.expectedBroken).toLocaleString()} expected broken</div>
                    </button>
                  </li>
                ))}
              </ol>
            </TabsContent>
            <TabsContent value="pump" className="mt-4">
              <AnimatePresence mode="wait">
                {data && selected != null && (
                  <motion.div key={data.ids[selected]} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <PumpPanel id={data.ids[selected]} country={country}
                      onPlan={() => router.push(`/dispatch?country=${country}&lat=${data.lat[selected]}&lon=${data.lon[selected]}`)} />
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "signal" }) {
  return (
    <div className="paper-card px-4 py-3">
      <p className="label-mono">{label}</p>
      <p className={`reading mt-1 text-2xl sm:text-3xl ${tone === "signal" ? "text-signal" : ""}`}>{value}</p>
    </div>
  );
}
