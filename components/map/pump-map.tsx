"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";

export type MapData = { ids: string[]; lat: number[]; lon: number[]; belief: number[]; served: number[]; adm2?: string[] };
export type Box = { minLat: number; maxLat: number; minLon: number; maxLon: number };
export type PathStop = { lat: number; lon: number; n?: number };

export type PumpMapHandle = { fit: (box?: Box) => void };

type Props = {
  data: MapData;
  /** 1 to show a point, 0 to hide. Same length as data. */
  mask?: Uint8Array | null;
  selected?: number | null;
  onSelect?: (i: number | null) => void;
  depot?: { lat: number; lon: number } | null;
  pickDepot?: boolean;
  onPickDepot?: (p: { lat: number; lon: number }) => void;
  route?: PathStop[];
  baseline?: PathStop[];
  /** Pumps to ring (e.g. stops on the plan), by data index. */
  highlight?: number[];
  className?: string;
  radiusKm?: number;
};

// Colour ramp for P(broken): teal-green, ochre, vermilion.
const STOPS: [number, [number, number, number]][] = [
  [0.0, [47, 158, 134]],
  [0.15, [104, 170, 130]],
  [0.27, [206, 190, 118]],
  [0.42, [240, 140, 60]],
  [0.62, [255, 72, 36]],
  [1.0, [255, 40, 20]],
];
const LUT = (() => {
  const out: string[] = [];
  for (let i = 0; i < 128; i++) {
    const t = i / 127;
    let a = STOPS[0], b = STOPS[STOPS.length - 1];
    for (let k = 0; k < STOPS.length - 1; k++) if (t >= STOPS[k][0] && t <= STOPS[k + 1][0]) { a = STOPS[k]; b = STOPS[k + 1]; break; }
    const u = (t - a[0]) / (b[0] - a[0] || 1);
    const c = a[1].map((v, j) => Math.round(v + (b[1][j] - v) * u));
    out.push(`rgb(${c[0]},${c[1]},${c[2]})`);
  }
  return out;
})();
export const rampColor = (p: number) => LUT[Math.max(0, Math.min(127, Math.round(p * 127)))];

type View = { lat: number; lon: number; k: number }; // k = pixels per degree of latitude

function boxOf(data: MapData, mask?: Uint8Array | null): Box {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (let i = 0; i < data.lat.length; i++) {
    if (mask && !mask[i]) continue;
    if (data.lat[i] < minLat) minLat = data.lat[i];
    if (data.lat[i] > maxLat) maxLat = data.lat[i];
    if (data.lon[i] < minLon) minLon = data.lon[i];
    if (data.lon[i] > maxLon) maxLon = data.lon[i];
  }
  if (minLat > maxLat) return { minLat: -1, maxLat: 1, minLon: -1, maxLon: 1 };
  return { minLat, maxLat, minLon, maxLon };
}

function viewFor(box: Box, w: number, h: number): View {
  const lat0 = (box.minLat + box.maxLat) / 2;
  const cos = Math.cos((lat0 * Math.PI) / 180);
  const spanLat = Math.max(0.02, box.maxLat - box.minLat);
  const spanLon = Math.max(0.02, (box.maxLon - box.minLon) * cos);
  const k = Math.min((h - 70) / spanLat, (w - 70) / spanLon);
  return { lat: lat0, lon: (box.minLon + box.maxLon) / 2, k };
}

function niceStep(minDeg: number) {
  const steps = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5];
  return steps.find((s) => s >= minDeg) ?? 5;
}

export const PumpMap = forwardRef<PumpMapHandle, Props>(function PumpMap(
  { data, mask, selected, onSelect, depot, pickDepot, onPickDepot, route, baseline, highlight, className, radiusKm },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 600, h: 400 });
  const [view, setView] = useState<View | null>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const viewRef = useRef<View | null>(null);
  viewRef.current = view;

  // Draw order: calm pumps first, likely-broken last so they sit on top.
  const order = useMemo(() => {
    const idx = Array.from({ length: data.lat.length }, (_, i) => i);
    idx.sort((a, b) => data.belief[a] - data.belief[b]);
    return idx;
  }, [data]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback((box?: Box) => setView(viewFor(box ?? boxOf(data, mask), size.w, size.h)), [data, mask, size.w, size.h]);
  useImperativeHandle(ref, () => ({ fit }), [fit]);

  // Fit once data and size are known, and again when the dataset changes.
  const fitted = useRef<MapData | null>(null);
  useEffect(() => {
    if (fitted.current !== data && size.w > 10) {
      fitted.current = data;
      fit();
    }
  }, [data, size.w, fit]);

  const toScreen = useCallback(
    (lat: number, lon: number, v: View) => {
      const cos = Math.cos((v.lat * Math.PI) / 180);
      return { x: size.w / 2 + (lon - v.lon) * cos * v.k, y: size.h / 2 - (lat - v.lat) * v.k };
    },
    [size.w, size.h],
  );
  const toGeo = useCallback(
    (x: number, y: number, v: View) => {
      const cos = Math.cos((v.lat * Math.PI) / 180);
      return { lat: v.lat - (y - size.h / 2) / v.k, lon: v.lon + (x - size.w / 2) / (v.k * cos) };
    },
    [size.w, size.h],
  );

  // ---- drawing
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !view) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(size.w * dpr);
    cv.height = Math.round(size.h * dpr);
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    // graticule
    const cos = Math.cos((view.lat * Math.PI) / 180);
    const step = niceStep(70 / view.k);
    const g0 = toGeo(0, size.h, view), g1 = toGeo(size.w, 0, view);
    ctx.lineWidth = 1;
    ctx.font = "10px 'JetBrains Mono Variable', monospace";
    ctx.fillStyle = "rgba(160,200,210,0.45)";
    ctx.strokeStyle = "rgba(120,170,185,0.13)";
    for (let lat = Math.ceil(g0.lat / step) * step; lat <= g1.lat; lat += step) {
      const y = Math.round(toScreen(lat, view.lon, view).y) + 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size.w, y); ctx.stroke();
      ctx.fillText(`${lat.toFixed(step < 0.1 ? 2 : 1)}°`, 6, y - 3);
    }
    for (let lon = Math.ceil(g0.lon / step) * step; lon <= g1.lon; lon += step) {
      const x = Math.round(toScreen(view.lat, lon, view).x) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size.h); ctx.stroke();
      ctx.fillText(`${lon.toFixed(step < 0.1 ? 2 : 1)}°`, x + 4, size.h - 6);
    }

    // service radius
    if (depot && radiusKm) {
      const c = toScreen(depot.lat, depot.lon, view);
      const r = (radiusKm / 111.32) * view.k;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.setLineDash([4, 6]); ctx.strokeStyle = "rgba(120,200,220,0.5)"; ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "rgba(60,150,180,0.05)"; ctx.fill();
    }

    // pumps
    const zoomBoost = Math.min(3.2, Math.max(0, Math.log2(view.k / 40) * 0.55));
    for (const i of order) {
      if (mask && !mask[i]) continue;
      const { x, y } = toScreen(data.lat[i], data.lon[i], view);
      if (x < -6 || y < -6 || x > size.w + 6 || y > size.h + 6) continue;
      const b = data.belief[i];
      const r = 0.9 + zoomBoost + b * 1.1 + Math.min(1.0, Math.log10(1 + data.served[i]) * 0.2);
      ctx.fillStyle = rampColor(b);
      ctx.globalAlpha = 0.45 + 0.5 * Math.min(1, b * 1.6);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // paths
    const drawPath = (pts: PathStop[], color: string, width: number, dash: number[] | null) => {
      if (!pts.length || !depot) return;
      ctx.beginPath();
      const s = toScreen(depot.lat, depot.lon, view);
      ctx.moveTo(s.x, s.y);
      for (const p of pts) { const q = toScreen(p.lat, p.lon, view); ctx.lineTo(q.x, q.y); }
      ctx.lineTo(s.x, s.y);
      ctx.lineWidth = width; ctx.strokeStyle = color; ctx.lineJoin = "round";
      if (dash) ctx.setLineDash(dash);
      ctx.stroke(); ctx.setLineDash([]);
    };
    if (baseline?.length) drawPath(baseline, "rgba(214,231,234,0.45)", 1.5, [3, 5]);
    if (route?.length) {
      drawPath(route, "#9fe3f2", 2.6, null);
      ctx.font = "600 11px 'JetBrains Mono Variable', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      route.forEach((p, k) => {
        const q = toScreen(p.lat, p.lon, view);
        ctx.beginPath(); ctx.arc(q.x, q.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#0a1a21"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#9fe3f2"; ctx.stroke();
        ctx.fillStyle = "#e9fbff"; ctx.fillText(String(p.n ?? k + 1), q.x, q.y + 0.5);
      });
      ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
    }
    highlight?.forEach((i) => {
      const q = toScreen(data.lat[i], data.lon[i], view);
      ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, Math.PI * 2); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.stroke();
    });

    // depot
    if (depot) {
      const q = toScreen(depot.lat, depot.lon, view);
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#f3eee2"; ctx.fillRect(-7, -7, 14, 14);
      ctx.strokeStyle = "#0a1a21"; ctx.lineWidth = 2; ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
      ctx.font = "600 10px 'JetBrains Mono Variable', monospace";
      ctx.fillStyle = "#f3eee2"; ctx.fillText("DEPOT", q.x + 14, q.y + 4);
    }

    // selected
    if (selected != null && selected >= 0) {
      const q = toScreen(data.lat[selected], data.lon[selected], view);
      ctx.beginPath(); ctx.arc(q.x, q.y, 11, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = "#f3eee2"; ctx.stroke();
      ctx.beginPath(); ctx.arc(q.x, q.y, 16, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(243,238,226,0.35)"; ctx.stroke();
    }

    // scale bar
    const kmPerPx = 111.32 / view.k;
    const nice = [0.5, 1, 2, 5, 10, 20, 50, 100, 200].find((n) => n / kmPerPx > 70) ?? 200;
    const px = nice / kmPerPx;
    const bx = size.w - px - 18, by = size.h - 18;
    ctx.strokeStyle = "#d6e7ea"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by); ctx.lineTo(bx + px, by); ctx.lineTo(bx + px, by - 4); ctx.stroke();
    ctx.fillStyle = "#d6e7ea"; ctx.font = "10px 'JetBrains Mono Variable', monospace"; ctx.fillText(`${nice} km`, bx, by - 8);
    void cos;
  }, [view, size, data, mask, order, selected, depot, route, baseline, highlight, radiusKm, toScreen, toGeo]);

  // ---- interaction
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; moved: boolean; v: View } | null>(null);
  const pinch = useRef<{ d: number; k: number } | null>(null);

  const nearest = useCallback(
    (x: number, y: number, maxPx = 12) => {
      const v = viewRef.current;
      if (!v) return -1;
      let best = -1, bd = maxPx * maxPx;
      const cos = Math.cos((v.lat * Math.PI) / 180);
      for (let i = 0; i < data.lat.length; i++) {
        if (mask && !mask[i]) continue;
        const px = size.w / 2 + (data.lon[i] - v.lon) * cos * v.k;
        const py = size.h / 2 - (data.lat[i] - v.lat) * v.k;
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    },
    [data, mask, size.w, size.h],
  );

  const zoomAt = (x: number, y: number, f: number) => {
    const v = viewRef.current;
    if (!v) return;
    const k = Math.max(8, Math.min(60000, v.k * f));
    const g = toGeo(x, y, v);
    const cos = Math.cos((v.lat * Math.PI) / 180);
    const nv: View = { k, lat: v.lat, lon: v.lon };
    // keep the geo point under the cursor fixed
    nv.lat = g.lat + (y - size.h / 2) / k;
    nv.lon = g.lon - (x - size.w / 2) / (k * cos);
    setView(nv);
  };

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const rel = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div ref={wrap} className={`overflow-hidden select-none touch-none ${className ?? "relative"}`}>
      <canvas
        ref={canvas}
        style={{ width: size.w, height: size.h, cursor: pickDepot ? "crosshair" : drag.current ? "grabbing" : hover ? "pointer" : "grab" }}
        className="absolute inset-0"
        aria-label="Map of hand pumps coloured by probability of being broken"
        role="img"
        onPointerDown={(e) => {
          canvas.current!.setPointerCapture(e.pointerId);
          const p = rel(e);
          pointers.current.set(e.pointerId, p);
          if (pointers.current.size === 2 && viewRef.current) {
            const [a, b] = [...pointers.current.values()];
            pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), k: viewRef.current.k };
            drag.current = null;
          } else if (viewRef.current) drag.current = { ...p, moved: false, v: viewRef.current };
        }}
        onPointerMove={(e) => {
          const p = rel(e);
          if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
          if (pinch.current && pointers.current.size === 2 && viewRef.current) {
            const [a, b] = [...pointers.current.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.current.k * (d / pinch.current.d)) / viewRef.current.k);
            return;
          }
          const d = drag.current;
          if (d) {
            const dx = p.x - d.x, dy = p.y - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
            if (d.moved) {
              const cos = Math.cos((d.v.lat * Math.PI) / 180);
              setView({ k: d.v.k, lat: d.v.lat + dy / d.v.k, lon: d.v.lon - dx / (d.v.k * cos) });
              setHover(null);
            }
          } else if (!pickDepot) {
            const i = nearest(p.x, p.y, 10);
            setHover(i >= 0 ? { i, x: p.x, y: p.y } : null);
          }
        }}
        onPointerUp={(e) => {
          const p = rel(e);
          pointers.current.delete(e.pointerId);
          if (pinch.current && pointers.current.size < 2) pinch.current = null;
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved && viewRef.current) {
            if (pickDepot && onPickDepot) onPickDepot(toGeo(p.x, p.y, viewRef.current));
            else if (onSelect) {
              const i = nearest(p.x, p.y, e.pointerType === "touch" ? 22 : 12);
              onSelect(i >= 0 ? i : null);
            }
          }
        }}
        onPointerLeave={() => setHover(null)}
      />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-white/15 bg-[#0a1a21]/95 px-2.5 py-1.5 text-[11px] text-[#d6e7ea] shadow-lg"
          style={{ left: Math.min(hover.x + 12, size.w - 190), top: Math.max(8, hover.y - 46) }}
        >
          <div className="reading text-[10px] opacity-70">{data.ids[hover.i]}</div>
          <div>
            {data.adm2?.[hover.i] ?? "Pump"} · <b className="reading">{Math.round(data.belief[hover.i] * 100)}%</b> likely broken · {data.served[hover.i]} people
          </div>
        </div>
      )}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
        {[
          { l: "Zoom in", i: <Plus className="size-4" />, f: () => zoomAt(size.w / 2, size.h / 2, 1.6) },
          { l: "Zoom out", i: <Minus className="size-4" />, f: () => zoomAt(size.w / 2, size.h / 2, 1 / 1.6) },
          { l: "Fit to data", i: <Maximize2 className="size-3.5" />, f: () => fit() },
        ].map((b) => (
          <button key={b.l} aria-label={b.l} onClick={b.f} className="grid size-8 place-items-center rounded-md border border-white/15 bg-[#0a1a21]/80 text-[#d6e7ea] backdrop-blur transition hover:bg-[#12303b]">
            {b.i}
          </button>
        ))}
      </div>
    </div>
  );
});

export function Legend({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-[10px] text-[#d6e7ea]/80 ${className ?? ""}`}>
      <span className="label-mono !text-[#d6e7ea]/70">Likely working</span>
      <span className="h-1.5 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${rampColor(0)}, ${rampColor(0.15)}, ${rampColor(0.27)}, ${rampColor(0.42)}, ${rampColor(0.7)})` }} />
      <span className="label-mono !text-[#d6e7ea]/70">Likely broken</span>
    </div>
  );
}
