"use client";
import { motion } from "framer-motion";
import { rampColor } from "@/components/map/pump-map";

type Hero = { dots: { x: number; y: number; r: number }[]; route: { x: number; y: number }[]; depot: { x: number; y: number }; W: number; H: number };

export function HeroMap({ data }: { data: Hero }) {
  const path = [data.depot, ...data.route, data.depot].map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("");
  return (
    <div className="night-panel relative overflow-hidden p-2 sm:p-4">
      <svg viewBox={`0 0 ${data.W} ${data.H}`} className="mx-auto h-auto w-full max-w-[520px]" role="img" aria-label="Map of hand pumps around Bo, Sierra Leone, coloured by chance of being broken, with one repair route drawn across them">
        {Array.from({ length: 6 }).map((_, i) => (
          <circle key={i} cx={data.depot.x} cy={data.depot.y} r={26 + i * 40} fill="none" stroke="#9fe3f2" strokeOpacity={0.18 - i * 0.025} />
        ))}
        {data.dots.map((d, i) => (
          <motion.circle key={i} cx={d.x} cy={d.y} r={2 + d.r * 2.6} fill={rampColor(d.r)} initial={{ opacity: 0 }} animate={{ opacity: 0.45 + d.r }} transition={{ delay: (i % 60) * 0.012, duration: 0.5 }} />
        ))}
        <motion.path d={path} fill="none" stroke="#9fe3f2" strokeWidth="2.6" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.1, duration: 2.2, ease: "easeInOut" }} />
        {data.route.map((p, i) => (
          <motion.g key={i} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.1 + (i / data.route.length) * 2.2 }} style={{ transformOrigin: `${p.x}px ${p.y}px` }}>
            <circle cx={p.x} cy={p.y} r="9" fill="#0a1a21" stroke="#9fe3f2" strokeWidth="2" />
            <text x={p.x} y={p.y + 3.6} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fontWeight="600" fill="#e9fbff">{i + 1}</text>
          </motion.g>
        ))}
        <g transform={`translate(${data.depot.x} ${data.depot.y}) rotate(45)`}><rect x="-7" y="-7" width="14" height="14" fill="#f3eee2" stroke="#0a1a21" strokeWidth="2" /></g>
      </svg>
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[10px] text-[#d6e7ea]/80">
        <span className="label-mono !text-[#d6e7ea]/70">Around Bo, Sierra Leone · one crew, one 8 hour shift</span>
      </div>
    </div>
  );
}
