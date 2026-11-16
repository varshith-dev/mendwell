import fs from "node:fs";
import path from "node:path";

export type CountryCard = {
  name: string; code: string; survey_year: number; source: string; n_pumps: number; n_broken: number; broken_rate: number;
  n_spatial_cells: number; leakage_audit_auc_with_pay_crucialness_pressure: number;
  metrics: { auc: number; auc_ci95: [number, number]; average_precision: number; brier: number; brier_prevalence_only: number; baseline_age_tech_logistic_auc: number };
  lift: { top_fraction: number; broken_rate: number; lift: number; share_of_all_broken_found: number }[];
  reliability: { mean_predicted: number; observed: number; n: number }[];
  roc: { fpr: number; tpr: number }[];
  importance: { feature: string; auc_drop: number; std: number }[];
};
export type ModelCard = {
  countries: Record<string, CountryCard>;
  leakage_audit: Record<string, string>;
  cv: string; model: string;
  transfer: { trained_on: string; tested_on: string; auc: number; note: string };
};
export type Variant = { label: string; pumps_visited: number; repairs_per_shift: number; repairs_se: number; people_per_shift: number; people_se: number; km_per_shift: number };
export type Backtest = {
  shift_hours: number;
  assumptions: Record<string, number | string>;
  countries: Record<string, { depots_simulated: number; pumps: number; base_rate: number; reported_pumps: number; variants: Record<string, Variant>; speed_sensitivity: { speed: number; planner: number; nearest: number }[] }>;
};

const read = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", f), "utf8")) as T;
export const loadModelCard = () => read<ModelCard>("model_card.json");
export const loadBacktest = () => read<Backtest>("backtest.json");
