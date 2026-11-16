"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { ExternalLink, Compass, Users, Wrench, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { posterior, type ReportKind } from "@/lib/risk";

type Detail = {
  id: string; country: string; lat: number; lon: number; adm1: string; adm2: string; adm3: string | null;
  tech: string; management: string; source: string; installYear: number | null; served: number; risk: number;
  reports: { kind: string; ageDays: number; simulated: boolean; weight: number; shift: number }[];
};

const KIND_LABEL: Record<string, string> = { broken: "Says broken", working: "Says working", low_flow: "Weak flow" };

export function Gauge({ prior, now }: { prior: number; now: number }) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <div>
      <div className="relative h-9">
        <div className="absolute inset-x-0 top-4 h-2 rounded-full" style={{ background: "linear-gradient(90deg,#2f9e86,#e0b24a 35%,#f06a2f 60%,#ff3b1f)" }} />
        {[0, 25, 50, 75, 100].map((t) => (
          <span key={t} className="absolute top-[26px] h-1.5 w-px bg-ink/40" style={{ left: `${t}%` }} />
        ))}
        <Marker at={prior} label="model" tone="ghost" />
        <Marker at={now} label="now" tone="solid" />
      </div>
      <div className="reading mt-3 flex justify-between text-[10px] text-ink-2"><span>0%</span><span>50%</span><span>100%</span></div>
      <div className="mt-2 flex gap-4 text-xs">
        <span><span className="label-mono">Model alone</span> <b className="reading">{pct(prior)}</b></span>
        <span><span className="label-mono">Now, with reports</span> <b className="reading">{pct(now)}</b></span>
      </div>
    </div>
  );
}
function Marker({ at, label, tone }: { at: number; label: string; tone: "ghost" | "solid" }) {
  return (
    <div className="absolute top-0 -translate-x-1/2" style={{ left: `${Math.min(98, Math.max(2, at * 100))}%` }}>
      <div className={`label-mono -mt-0.5 text-center !text-[9px] ${tone === "solid" ? "!text-ink" : ""}`}>{label}</div>
      <div className={`mx-auto size-3 rounded-full border-2 ${tone === "solid" ? "border-paper bg-ink" : "border-ink bg-paper"}`} style={{ marginTop: 5 }} />
    </div>
  );
}

export function PumpPanel({ id, country, onPlan }: { id: string; country: string; onPlan?: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [qr, setQr] = useState<string>("");
  useEffect(() => {
    let live = true;
    setD(null);
    fetch(`/api/pumps/${encodeURIComponent(id)}`).then((r) => r.json()).then((j) => live && setD(j));
    QRCode.toDataURL(`${window.location.origin}/p/${encodeURIComponent(id)}`, { margin: 1, width: 160, color: { dark: "#0f222b", light: "#faf6ec" } }).then((u) => live && setQr(u));
    return () => { live = false; };
  }, [id]);

  if (!d) return <div className="space-y-3 p-1"><div className="h-6 w-2/3 animate-pulse rounded bg-paper-2" /><div className="h-24 animate-pulse rounded bg-paper-2" /></div>;
  const now = posterior(d.risk, d.reports.map((r) => ({ kind: r.kind as ReportKind, ageDays: r.ageDays })));
  const age = d.installYear ? (country === "uganda" ? 2009 : 2016) - d.installYear : null;
  return (
    <div className="space-y-5">
      <div>
        <p className="label-mono">{d.adm1} · {d.adm2}{d.adm3 ? ` · ${d.adm3}` : ""}</p>
        <h3 className="mt-1 text-xl leading-tight reading !font-medium !tracking-tight !font-[family-name:var(--font-mono)] break-all">{d.id}</h3>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Fact icon={<Users className="size-4" />} k="People served" v={d.served.toLocaleString()} />
        <Fact icon={<Wrench className="size-4" />} k="Pump" v={d.tech.replace("Unspecified", "Hand pump")} />
        <Fact icon={<CalendarClock className="size-4" />} k="Installed" v={d.installYear ? `${d.installYear}${age != null ? ` (${age} yr at survey)` : ""}` : "Unknown"} />
        <Fact icon={<Compass className="size-4" />} k="Managed by" v={d.management === "Unknown" ? "Not recorded" : d.management.replace("Management", "").trim()} />
      </dl>
      <div>
        <p className="label-mono mb-2">Chance it is broken</p>
        <Gauge prior={d.risk} now={now} />
      </div>
      <div>
        <p className="label-mono mb-2">Community reports ({d.reports.length})</p>
        {d.reports.length === 0 ? (
          <p className="text-sm text-ink-2">No reports yet. The score is the model alone.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {d.reports.slice(0, 5).map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-paper-2/70 px-2.5 py-1.5">
                <span>{KIND_LABEL[r.kind] ?? r.kind} {r.simulated && <Badge variant="outline" className="ml-1 !text-[9px]">simulated</Badge>}</span>
                <span className="reading text-xs text-ink-2">{r.ageDays < 1 ? "today" : `${Math.round(r.ageDays)}d ago`} · {r.shift > 0 ? "+" : ""}{r.shift.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-rule bg-card p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt={`QR code that opens the report page for ${d.id}`} width={84} height={84} className="rounded" />}
        <div className="text-xs text-ink-2">
          Print this on a sticker for the pump. Anyone with a phone can report in two taps, no account.
          <div className="mt-2 flex flex-wrap gap-2">
            <Button nativeButton={false} size="sm" variant="outline" render={<Link href={`/p/${encodeURIComponent(d.id)}`} target="_blank" />}><ExternalLink /> Open page</Button>
            {onPlan && <Button size="sm" onClick={onPlan}><Compass /> Plan from here</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div>
      <dt className="label-mono flex items-center gap-1.5">{icon}{k}</dt>
      <dd className="mt-0.5 font-medium leading-snug">{v}</dd>
    </div>
  );
}
