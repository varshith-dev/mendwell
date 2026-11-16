/** Hand-built SVG charts. No chart library, so the look matches the design system exactly. */

const W = 320, H = 240, PAD = { l: 38, r: 12, t: 12, b: 34 };
const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
const x = (v: number) => PAD.l + v * iw;
const y = (v: number) => PAD.t + (1 - v) * ih;

function Axes({ xl, yl }: { xl: string; yl: string }) {
  return (
    <g fontFamily="var(--font-mono)" fontSize="9" fill="var(--ink-2)">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} stroke="var(--rule)" />
          <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(1)} stroke="var(--rule)" />
          <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end">{t.toFixed(2).replace(/0$/, "")}</text>
          <text x={x(t)} y={H - 18} textAnchor="middle">{t.toFixed(2).replace(/0$/, "")}</text>
        </g>
      ))}
      <text x={x(0.5)} y={H - 4} textAnchor="middle" letterSpacing="1">{xl}</text>
      <text transform={`translate(10 ${y(0.5)}) rotate(-90)`} textAnchor="middle" letterSpacing="1">{yl}</text>
    </g>
  );
}

export function RocChart({ points, auc, label }: { points: { fpr: number; tpr: number }[]; auc: number; label: string }) {
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(p.fpr).toFixed(1)} ${y(p.tpr).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`ROC curve for ${label}, area under curve ${auc.toFixed(2)}`} className="w-full">
      <Axes xl="FALSE ALARM RATE" yl="BROKEN PUMPS FOUND" />
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--ink-2)" strokeDasharray="3 4" />
      <path d={`${d}L${x(1)} ${y(0)}L${x(0)} ${y(0)}Z`} fill="var(--lake)" fillOpacity="0.12" />
      <path d={d} fill="none" stroke="var(--lake)" strokeWidth="2.2" />
      <text x={x(0.98)} y={y(0.1)} textAnchor="end" fontFamily="var(--font-mono)" fontSize="11" fill="var(--ink)">AUC {auc.toFixed(2)}</text>
    </svg>
  );
}

export function ReliabilityChart({ bins, label }: { bins: { mean_predicted: number; observed: number; n: number }[]; label: string }) {
  const max = Math.max(0.6, ...bins.map((b) => Math.max(b.mean_predicted, b.observed))) * 1.05;
  const sx = (v: number) => PAD.l + (v / max) * iw;
  const sy = (v: number) => PAD.t + (1 - v / max) * ih;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Calibration chart for ${label}`} className="w-full">
      <g fontFamily="var(--font-mono)" fontSize="9" fill="var(--ink-2)">
        {[0, 0.2, 0.4, 0.6].filter((t) => t <= max).map((t) => (
          <g key={t}>
            <line x1={sx(0)} x2={sx(max)} y1={sy(t)} y2={sy(t)} stroke="var(--rule)" />
            <line x1={sx(t)} x2={sx(t)} y1={sy(0)} y2={sy(max)} stroke="var(--rule)" />
            <text x={PAD.l - 6} y={sy(t) + 3} textAnchor="end">{Math.round(t * 100)}%</text>
            <text x={sx(t)} y={H - 18} textAnchor="middle">{Math.round(t * 100)}%</text>
          </g>
        ))}
        <text x={x(0.5)} y={H - 4} textAnchor="middle" letterSpacing="1">WHAT THE MODEL SAID</text>
        <text transform={`translate(10 ${y(0.5)}) rotate(-90)`} textAnchor="middle" letterSpacing="1">WHAT WAS FOUND</text>
      </g>
      <line x1={sx(0)} y1={sy(0)} x2={sx(max)} y2={sy(max)} stroke="var(--ink-2)" strokeDasharray="3 4" />
      <path d={bins.map((b, i) => `${i ? "L" : "M"}${sx(b.mean_predicted).toFixed(1)} ${sy(b.observed).toFixed(1)}`).join("")} fill="none" stroke="var(--signal)" strokeWidth="1.6" />
      {bins.map((b, i) => <circle key={i} cx={sx(b.mean_predicted)} cy={sy(b.observed)} r="3.6" fill="var(--signal)" stroke="var(--card)" strokeWidth="1.4" />)}
    </svg>
  );
}

export function HBars({ rows, unit, format = (v: number) => v.toFixed(1), highlight, max: forcedMax }: {
  rows: { label: string; value: number; se?: number; muted?: boolean }[];
  unit?: string; format?: (v: number) => string; highlight?: string; max?: number;
}) {
  const max = forcedMax ?? Math.max(...rows.map((r) => r.value + (r.se ?? 0) * 1.96)) * 1.04;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const hi = r.label === highlight;
        return (
          <li key={r.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
              <span className={hi ? "font-semibold" : "text-ink-2"}>{r.label}</span>
              <span className="reading text-xs">{format(r.value)}{unit ? ` ${unit}` : ""}</span>
            </div>
            <div className="relative h-3 rounded-sm bg-paper-2">
              <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(r.value / max) * 100}%`, background: hi ? "var(--lake)" : r.muted ? "color-mix(in oklab, var(--ink) 25%, transparent)" : "color-mix(in oklab, var(--lake) 45%, var(--paper-2))" }} />
              {r.se != null && (
                <div className="absolute top-1/2 h-px bg-ink" style={{ left: `${(Math.max(0, r.value - 1.96 * r.se) / max) * 100}%`, width: `${((3.92 * r.se) / max) * 100}%` }}>
                  <span className="absolute -left-px top-[-3px] h-[7px] w-px bg-ink" /><span className="absolute -right-px top-[-3px] h-[7px] w-px bg-ink" />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
