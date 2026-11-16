import type { Metadata } from "next";
import { HBars, ReliabilityChart, RocChart } from "@/components/charts/charts";
import { loadBacktest, loadModelCard, type CountryCard } from "@/lib/evidence";

export const metadata: Metadata = { title: "Evidence" };

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const FEATURE_NAMES: Record<string, string> = {
  tech: "Pump model", management: "Who manages it", installer: "Installer", distance_to_city: "Distance to city", distance_to_primary: "Distance to main road",
  distance_to_secondary: "Distance to secondary road", distance_to_tertiary: "Distance to minor road", distance_to_town: "Distance to town", age: "Age of pump",
  local_population: "Local population", served_population: "People served", lat_deg: "Latitude", lon_deg: "Longitude", source_type: "Source type",
};

export default function EvidencePage() {
  const card = loadModelCard();
  const bt = loadBacktest();
  const order = ["sierra_leone", "uganda"] as const;

  return (
    <div className="space-y-14">
      <header className="max-w-3xl">
        <p className="label-mono">Evidence · fig. 04</p>
        <h1 className="mt-1 text-4xl sm:text-5xl">What the numbers say, including the weak parts</h1>
        <p className="mt-4 text-lg text-ink-2">
          Everything here is computed from real survey outcomes: 10,928 pumps in Sierra Leone and 24,574 in Uganda. The model is modest. The planner around it is where most of the gain comes from. Both are shown with their uncertainty.
        </p>
      </header>

      {/* ---------------- backtest */}
      <section aria-labelledby="bt">
        <div className="mb-6 max-w-3xl">
          <p className="label-mono">A · Dispatch backtest</p>
          <h2 id="bt" className="mt-1 text-3xl">Does planning the day beat driving to the nearest pump?</h2>
          <p className="mt-3 text-ink-2">
            For each country we drew {bt.countries.sierra_leone.depots_simulated} random depots and planned one {bt.shift_hours}-hour shift with each strategy. A strategy only sees what a planner would know: the model&apos;s score for each pump, never its survey status. Then we replayed the shift against the real status of every pump it visited. A broken pump costs {String(bt.assumptions.repairHours)} h to fix, a working one {String(bt.assumptions.checkHours)} h to check, and the crew drives {String(bt.assumptions.speedKmh)} km/h on roads {Math.round((Number(bt.assumptions.detour) - 1) * 100)}% longer than a straight line.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {order.map((k) => {
            const c = bt.countries[k];
            const v = c.variants;
            const name = card.countries[k].name;
            const gainPeople = v.planner.people_per_shift / v.nearest.people_per_shift;
            const gainPumps = v.planner_pumps.repairs_per_shift / v.nearest.repairs_per_shift;
            return (
              <div key={k} className="paper-card space-y-6 p-5">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-2xl">{name}</h3>
                  <span className="label-mono">{c.depots_simulated} simulated shifts</span>
                </div>
                <div>
                  <p className="label-mono mb-3">People whose water comes back, per shift</p>
                  <HBars highlight="Mendwell planner" format={(n) => Math.round(n).toLocaleString()} rows={[
                    { label: "Random order", value: v.random.people_per_shift, se: v.random.people_se, muted: true },
                    { label: "Nearest pump first", value: v.nearest.people_per_shift, se: v.nearest.people_se, muted: true },
                    { label: "Highest risk first", value: v.risk.people_per_shift, se: v.risk.people_se, muted: true },
                    { label: "Planner, no risk model", value: v.planner_noModel.people_per_shift, se: v.planner_noModel.people_se },
                    { label: "Mendwell planner", value: v.planner.people_per_shift, se: v.planner.people_se },
                    { label: "Planner + 5% of pumps reported", value: v.planner_reports.people_per_shift, se: v.planner_reports.people_se },
                    { label: "Upper bound: knows every status", value: v.oracle.people_per_shift, se: v.oracle.people_se, muted: true },
                  ]} />
                  <p className="mt-3 text-sm"><b className="reading">{gainPeople.toFixed(1)}×</b> the people of a nearest-first crew.</p>
                </div>
                <div>
                  <p className="label-mono mb-3">Pumps fixed per shift, when the goal is pump count</p>
                  <HBars highlight="Mendwell planner (pump goal)" format={(n) => n.toFixed(2)} rows={[
                    { label: "Nearest pump first", value: v.nearest.repairs_per_shift, se: v.nearest.repairs_se, muted: true },
                    { label: "Planner, no risk model", value: v.planner_pumps_noModel.repairs_per_shift, se: v.planner_pumps_noModel.repairs_se },
                    { label: "Mendwell planner (pump goal)", value: v.planner_pumps.repairs_per_shift, se: v.planner_pumps.repairs_se },
                    { label: "Upper bound: knows every status", value: v.oracle.repairs_per_shift, se: v.oracle.repairs_se, muted: true },
                  ]} />
                  <p className="mt-3 text-sm"><b className="reading">{gainPumps >= 1 ? "+" : ""}{Math.round((gainPumps - 1) * 100)}%</b> pumps fixed vs nearest-first{Math.abs(gainPumps - 1) < 0.1 ? ", inside the noise for this country" : ""}.</p>
                </div>
                <p className="border-t border-rule pt-3 text-xs text-ink-2">Bars show the mean with a 95% interval. Slower roads hurt every strategy: at 12 km/h the planner (people goal) fixes {c.speed_sensitivity[0].planner.toFixed(1)} pumps per shift and nearest-first {c.speed_sensitivity[0].nearest.toFixed(1)}; at 30 km/h it is {c.speed_sensitivity[2].planner.toFixed(1)} against {c.speed_sensitivity[2].nearest.toFixed(1)}. The people goal gives up some raw pump count to reach bigger communities.</p>
              </div>
            );
          })}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Callout title="Where the gain really comes from">Most of the lift comes from steering crews to pumps that serve many people and are close together. The risk model adds a smaller gain on top: about +{Math.round((bt.countries.sierra_leone.variants.planner.people_per_shift / bt.countries.sierra_leone.variants.planner_noModel.people_per_shift - 1) * 100)}% people in Sierra Leone and nothing we can separate from noise in Uganda.</Callout>
          <Callout title="Why reports matter">One accurate report is worth more than the model&apos;s score for that pump. With only 5% of pumps reported, Sierra Leone gains another {Math.round((bt.countries.sierra_leone.variants.planner_reports.people_per_shift / bt.countries.sierra_leone.variants.planner.people_per_shift - 1) * 100)}%. The report accuracy (85%) is an assumption.</Callout>
          <Callout title="Risk-first alone loses">Chasing the highest scores without thinking about distance fixes {bt.countries.sierra_leone.variants.risk.repairs_per_shift.toFixed(1)} pumps a shift in Sierra Leone, against {bt.countries.sierra_leone.variants.nearest.repairs_per_shift.toFixed(1)} for nearest-first. Routing is not optional.</Callout>
        </div>
      </section>

      {/* ---------------- model card */}
      <section aria-labelledby="mc">
        <div className="mb-6 max-w-3xl">
          <p className="label-mono">B · Model card</p>
          <h2 id="mc" className="mt-1 text-3xl">The risk model, scored on places it has never seen</h2>
          <p className="mt-3 text-ink-2">
            Gradient boosted trees on pump model, age, manager, installer, distance to roads and towns, population and location. {card.cv}. Every score on the board is out-of-fold: the model that produced it never saw that pump.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {order.map((k) => <ModelBlock key={k} c={card.countries[k]} />)}
        </div>
      </section>

      {/* ---------------- leakage */}
      <section aria-labelledby="lk" className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="label-mono">C · What we threw out</p>
          <h2 id="lk" className="mt-1 text-3xl">Scores that looked better than they were</h2>
          <p className="mt-3 text-ink-2">The first Sierra Leone model scored an AUC of 0.99. It was cheating. We removed every column that is filled in only for working pumps, or computed from the status.</p>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            {order.map((k) => (
              <div key={k} className="paper-card p-4">
                <dt className="label-mono">{card.countries[k].name}</dt>
                <dd className="reading mt-1 text-3xl text-signal line-through decoration-2">{card.countries[k].leakage_audit_auc_with_pay_crucialness_pressure.toFixed(2)}</dd>
                <dd className="reading text-lg">{card.countries[k].metrics.auc.toFixed(2)} <span className="text-xs text-ink-2">honest</span></dd>
              </div>
            ))}
          </dl>
        </div>
        <ul className="space-y-3 self-center">
          {Object.entries(card.leakage_audit).map(([col, why]) => (
            <li key={col} className="paper-card p-4"><p className="reading text-sm font-medium">{col}</p><p className="mt-1 text-sm text-ink-2">{why}</p></li>
          ))}
          <li className="paper-card p-4"><p className="reading text-sm font-medium">Other survey years</p><p className="mt-1 text-sm text-ink-2">India rows in the same open dataset looked usable but are not: about three quarters of the &quot;non-functional&quot; labels come from older imports where the survey&apos;s own status field says the pump works, and the label tracks the survey year almost perfectly. We left India out rather than report a number we do not trust.</p></li>
        </ul>
      </section>

      {/* ---------------- data */}
      <section aria-labelledby="ds" className="grid gap-8 lg:grid-cols-2">
        <div>
          <p className="label-mono">D · Data</p>
          <h2 id="ds" className="mt-1 text-3xl">Sources, all open</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li><a className="font-medium underline underline-offset-4" href="https://data.waterpointdata.org/dataset/Water-Point-Data-Exchange-Plus-WPdx-/eqje-vguj" target="_blank" rel="noreferrer">Water Point Data Exchange, WPdx+</a>: the open global water point dataset, API pulled with no key. We keep one national census per country so the survey campaign cannot leak into the label.</li>
            <li><b>Sierra Leone</b>: {card.countries.sierra_leone.source}. {card.countries.sierra_leone.n_pumps.toLocaleString()} hand pumps, {pct(card.countries.sierra_leone.broken_rate)} broken at survey.</li>
            <li><b>Uganda</b>: {card.countries.uganda.source}. {card.countries.uganda.n_pumps.toLocaleString()} Afridev hand pumps, {pct(card.countries.uganda.broken_rate)} broken at survey.</li>
            <li><a className="font-medium underline underline-offset-4" href="https://data.unicef.org/resources/jmp-report-2025/" target="_blank" rel="noreferrer">WHO/UNICEF JMP 2025</a>: 2.1 billion people still lack safely managed drinking water.</li>
            <li><a className="font-medium underline underline-offset-4" href="https://doi.org/10.1080/07900627.2018.1543117" target="_blank" rel="noreferrer">Foster et al. (2019), handpump functionality review</a>: about one in four handpumps in sub-Saharan Africa are non-functional at any point in time (26%, roughly 175,000 pumps, in 2015).</li>
          </ul>
        </div>
        <div>
          <p className="label-mono">E · Limits we know about</p>
          <h2 className="mt-1 text-3xl">What this does not prove</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink-2">
            <li>The surveys are snapshots from 2009 and 2016. A pump broken then may be fixed now. The demo replays them as if they were today, to test the planner against real outcomes. A live deployment needs a fresh status for a sample of pumps.</li>
            <li>Travel times use a fixed 1.4× detour on straight-line distance, not a road network. Repair time, speed and parts cost are stated assumptions.</li>
            <li>Cross-country transfer is weak (AUC {card.transfer.auc.toFixed(2)}, trained on Sierra Leone and scored on Uganda). Each country needs its own model.</li>
            <li>Community report accuracy (85%) and its 14 day half-life are assumptions. The seeded reports in the demo are simulated and flagged as such.</li>
            <li>The model finds risk, not cause. Uganda leans on location, which means it learned district effects, such as local maintenance, not mechanical failure.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-rule bg-paper-2/60 p-4">
      <p className="display text-lg">{title}</p>
      <p className="mt-1.5 text-sm text-ink-2">{children}</p>
    </div>
  );
}

function ModelBlock({ c }: { c: CountryCard }) {
  const m = c.metrics;
  const maxImp = Math.max(...c.importance.slice(0, 6).map((i) => i.auc_drop));
  return (
    <div className="paper-card space-y-5 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-2xl">{c.name}</h3>
        <span className="label-mono">{c.n_pumps.toLocaleString()} pumps · {c.n_spatial_cells} map cells</span>
      </div>
      <dl className="grid grid-cols-4 gap-3">
        <Metric k="AUC" v={m.auc.toFixed(2)} sub={`${m.auc_ci95[0].toFixed(2)} to ${m.auc_ci95[1].toFixed(2)}`} />
        <Metric k="Precision-recall" v={m.average_precision.toFixed(2)} sub={`base ${pct(c.broken_rate)}`} />
        <Metric k="Brier" v={m.brier.toFixed(3)} sub={`flat ${m.brier_prevalence_only.toFixed(3)}`} />
        <Metric k="Age + pump type" v={m.baseline_age_tech_logistic_auc.toFixed(2)} sub="simple baseline" />
      </dl>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><p className="label-mono mb-1">ROC</p><RocChart points={c.roc} auc={m.auc} label={c.name} /></div>
        <div><p className="label-mono mb-1">Calibration</p><ReliabilityChart bins={c.reliability} label={c.name} /></div>
      </div>
      <div>
        <p className="label-mono mb-2">If a crew only checks the top-scored pumps</p>
        <table className="w-full text-sm">
          <thead><tr className="label-mono text-left"><th className="pb-1 font-normal">Top</th><th className="pb-1 font-normal">Broken</th><th className="pb-1 font-normal">Lift</th><th className="pb-1 text-right font-normal">Share of all broken found</th></tr></thead>
          <tbody className="reading">
            {c.lift.map((l) => (
              <tr key={l.top_fraction} className="border-t border-rule"><td className="py-1.5">{pct(l.top_fraction)}</td><td>{pct(l.broken_rate)}</td><td>{l.lift.toFixed(1)}×</td><td className="text-right">{pct(l.share_of_all_broken_found)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <p className="label-mono mb-2">What the model leans on (AUC lost when shuffled)</p>
        <ul className="space-y-1.5">
          {c.importance.slice(0, 6).map((i) => (
            <li key={i.feature} className="grid grid-cols-[9.5rem_1fr_3rem] items-center gap-2 text-[13px]">
              <span className="truncate text-ink-2">{FEATURE_NAMES[i.feature] ?? i.feature}</span>
              <span className="h-2 rounded-sm bg-paper-2"><span className="block h-full rounded-sm bg-lake" style={{ width: `${Math.max(2, (i.auc_drop / maxImp) * 100)}%` }} /></span>
              <span className="reading text-right text-xs">{i.auc_drop.toFixed(3)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Metric({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div>
      <dt className="label-mono !text-[9px]">{k}</dt>
      <dd className="reading mt-0.5 text-2xl leading-none">{v}</dd>
      <dd className="reading mt-1 text-[10px] text-ink-2">{sub}</dd>
    </div>
  );
}
