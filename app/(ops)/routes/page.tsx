import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { COUNTRY_LABEL, type Country } from "@/lib/countries";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Routes" };

export default async function RoutesPage() {
  const s = await requireUser("/routes");
  const routes = await db.route.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { stops: { select: { outcome: true, pump: { select: { served: true } } } }, createdBy: { select: { name: true } } } });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-mono">Routes · fig. 03</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">Crew routes</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-2">Each saved plan becomes a route a technician can open on a phone and tick off stop by stop.</p>
        </div>
        {s.role === "officer" && <Link href="/dispatch" className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink px-4 text-sm text-paper">Plan a new route <ArrowRight className="size-4" /></Link>}
      </div>
      {routes.length === 0 ? (
        <div className="paper-card p-8 text-center text-ink-2">No routes yet. Plan one in Dispatch.</div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {routes.map((r) => {
            const done = r.stops.filter((x) => x.outcome).length;
            const fixed = r.stops.filter((x) => x.outcome === "fixed").reduce((a, x) => a + x.pump.served, 0);
            return (
              <li key={r.id}>
                <Link href={`/route/${r.id}`} className="paper-card block p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="label-mono">{COUNTRY_LABEL[r.country as Country]}</span>
                    <Badge variant={r.status === "done" ? "secondary" : "outline"}>{r.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="display mt-2 text-xl">{r.stops.length} stops · {r.totalKm.toFixed(0)} km</p>
                  <p className="reading mt-1 text-xs text-ink-2">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC · by {r.createdBy.name.replace(" (demo officer)", "")}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-lake" style={{ width: `${(done / r.stops.length) * 100}%` }} /></div>
                  <p className="reading mt-2 text-xs text-ink-2">{done}/{r.stops.length} visited · {fixed.toLocaleString()} people back on water · expected {Math.round(r.expectedPeople).toLocaleString()}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
