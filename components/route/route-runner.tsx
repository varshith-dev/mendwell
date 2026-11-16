"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, MapPinned, Navigation, Wrench, Droplets, PackageX, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { COUNTRY_LABEL, type Country } from "@/lib/countries";

type Stop = {
  id: string; seq: number; legKm: number; arriveHours: number; belief: number; outcome: string | null; note: string | null;
  pump: { id: string; adm1: string; adm2: string; adm3: string | null; tech: string; installYear: number | null; served: number; lat: number; lon: number };
};
type R = { id: string; country: string; status: string; expectedPeople: number; expectedRepairs: number; totalKm: number; depotLat: number; depotLon: number };

const hrs = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;
const OUT_LABEL: Record<string, string> = { fixed: "Fixed", working: "Already working", needs_parts: "Needs parts", not_found: "Could not find" };

export function RouteRunner({ route, stops: initial }: { route: R; stops: Stop[] }) {
  const [stops, setStops] = useState(initial);
  const [open, setOpen] = useState<string | null>(initial.find((s) => !s.outcome)?.id ?? null);
  const [found, setFound] = useState<Record<string, { broken: boolean; year: number }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const done = stops.filter((s) => s.outcome).length;
  const back = stops.filter((s) => s.outcome === "fixed").reduce((a, s) => a + s.pump.served, 0);
  const fixed = stops.filter((s) => s.outcome === "fixed").length;

  async function arrive(id: string) {
    setBusy(id); setErr("");
    const r = await fetch(`/api/stops/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "arrive" }) });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) return setErr(j.error ?? "Could not check in.");
    setFound((f) => ({ ...f, [id]: { broken: j.broken, year: j.replayedFrom } }));
  }
  async function outcome(id: string, o: string) {
    setBusy(id); setErr("");
    const r = await fetch(`/api/stops/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "outcome", outcome: o }) });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) return setErr(j.error ?? "Could not save.");
    setStops((ss) => {
      const next = ss.map((s) => (s.id === id ? { ...s, outcome: o } : s));
      setOpen(next.find((s) => !s.outcome)?.id ?? null);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="label-mono">Route · {COUNTRY_LABEL[route.country as Country]}</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">Today&apos;s run</h1>
      </div>

      <div className="paper-card p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="label-mono">People back on water</p>
            <p className="reading text-4xl text-lake">{back.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="label-mono">Visited</p>
            <p className="reading text-2xl">{done}<span className="text-ink-2">/{stops.length}</span></p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper-2"><motion.div className="h-full rounded-full bg-lake" animate={{ width: `${(done / stops.length) * 100}%` }} /></div>
        <p className="reading mt-2 text-xs text-ink-2">Plan expected ~{Math.round(route.expectedPeople).toLocaleString()} people and {route.expectedRepairs.toFixed(1)} repairs over {route.totalKm.toFixed(0)} km. Fixed so far: {fixed}.</p>
      </div>

      {err && <p role="alert" className="rounded-md border border-signal/40 bg-signal/10 p-3 text-sm text-signal">{err}</p>}

      <ol className="space-y-3">
        {stops.map((s) => {
          const isOpen = open === s.id && !s.outcome;
          const f = found[s.id];
          return (
            <li key={s.id} className={`paper-card overflow-hidden ${s.outcome ? "opacity-80" : ""}`}>
              <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => !s.outcome && setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
                <span className={`reading grid size-9 shrink-0 place-items-center rounded-full text-sm ${s.outcome ? "bg-moss text-paper" : "bg-ink text-paper"}`}>{s.outcome ? <Check className="size-4" /> : s.seq}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{s.pump.adm2}{s.pump.adm3 ? `, ${s.pump.adm3}` : ""}</span>
                  <span className="reading block truncate text-xs text-ink-2">{s.pump.id} · {s.pump.served.toLocaleString()} people · {s.legKm.toFixed(1)} km · ETA {hrs(s.arriveHours)}</span>
                </span>
                {s.outcome ? <Badge variant="secondary">{OUT_LABEL[s.outcome]}</Badge> : <Badge variant="outline" className="reading">{Math.round(s.belief * 100)}% broken</Badge>}
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="space-y-4 border-t border-rule bg-paper-2/50 p-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><p className="label-mono">Pump</p><p>{s.pump.tech.replace("Unspecified", "Hand pump")}</p></div>
                        <div><p className="label-mono">Installed</p><p>{s.pump.installYear ?? "Unknown"}</p></div>
                      </div>
                      <Button nativeButton={false} variant="outline" size="lg" className="h-10 w-full" render={<a href={`https://www.google.com/maps/dir/?api=1&destination=${s.pump.lat},${s.pump.lon}`} target="_blank" rel="noreferrer" />}>
                        <Navigation /> Directions
                      </Button>
                      {!f ? (
                        <Button size="lg" className="h-11 w-full" onClick={() => arrive(s.id)} disabled={busy === s.id}>
                          {busy === s.id ? <Loader2 className="animate-spin" /> : <MapPinned />} I&apos;m here: inspect the pump
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <div className={`rounded-lg border p-3 text-sm ${f.broken ? "border-signal/40 bg-signal/10" : "border-moss/40 bg-moss/10"}`}>
                            <p className="font-medium">{f.broken ? "You find it broken." : "You find it working."}</p>
                            <p className="mt-0.5 text-xs text-ink-2">Demo replay: this is what the {f.year} national survey recorded, held back until you arrived.</p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {f.broken ? (
                              <>
                                <Out icon={<Wrench />} label="Fixed it" on={() => outcome(s.id, "fixed")} busy={busy === s.id} primary />
                                <Out icon={<PackageX />} label="Needs parts" on={() => outcome(s.id, "needs_parts")} busy={busy === s.id} />
                                <Out icon={<SearchX />} label="Could not reach it" on={() => outcome(s.id, "not_found")} busy={busy === s.id} />
                              </>
                            ) : (
                              <Out icon={<Droplets />} label="Working, nothing to do" on={() => outcome(s.id, "working")} busy={busy === s.id} primary />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ol>
      {done === stops.length && <p className="paper-card p-4 text-center text-sm">Route complete. {back.toLocaleString()} people have water again because of today&apos;s run.</p>}
    </div>
  );
}

function Out({ icon, label, on, busy, primary }: { icon: React.ReactNode; label: string; on: () => void; busy: boolean; primary?: boolean }) {
  return (
    <Button size="lg" variant={primary ? "default" : "outline"} className="h-11 w-full" onClick={on} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : icon} {label}
    </Button>
  );
}
