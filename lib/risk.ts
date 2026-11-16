/**
 * Combine the model's prior with community reports.
 *
 * Reports are treated as noisy sensors with a stated accuracy. A "broken" report has the
 * likelihood ratio acc / (1 - acc); a "working" report has the inverse. Old reports fade with
 * a half-life, so a report from last month says little about today.
 * The accuracy (default 0.85) and the half-life (default 14 days) are assumptions, not
 * measurements. They are exposed as settings in the dispatch planner.
 */
export type ReportKind = "broken" | "working" | "low_flow";

export const REPORT_ACCURACY = 0.85;
export const REPORT_HALF_LIFE_DAYS = 14;

export function reportLogLR(kind: ReportKind, accuracy = REPORT_ACCURACY): number {
  const lr = accuracy / (1 - accuracy);
  if (kind === "broken") return Math.log(lr);
  if (kind === "working") return -Math.log(lr);
  return Math.log(lr) * 0.4; // low flow: a weaker sign that a repair is due
}

export function decay(ageDays: number, halfLife = REPORT_HALF_LIFE_DAYS): number {
  return Math.pow(0.5, Math.max(0, ageDays) / halfLife);
}

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (p: number) => Math.min(0.995, Math.max(0.005, p));

export function posterior(
  prior: number,
  reports: { kind: ReportKind; ageDays: number }[],
  opts: { accuracy?: number; halfLife?: number } = {},
): number {
  let z = logit(clamp(prior));
  for (const r of reports) {
    z += reportLogLR(r.kind, opts.accuracy ?? REPORT_ACCURACY) * decay(r.ageDays, opts.halfLife ?? REPORT_HALF_LIFE_DAYS);
  }
  return clamp(sigmoid(z));
}
