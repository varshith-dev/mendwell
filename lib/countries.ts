export type Country = "sierra_leone" | "uganda";
export const COUNTRY_LABEL: Record<Country, string> = { sierra_leone: "Sierra Leone", uganda: "Uganda" };
export const COUNTRY_SURVEY: Record<Country, string> = {
  sierra_leone: "Ministry of Water Resources, 2016 water point mapping",
  uganda: "Ministry of Water and Environment, 2009 inventory",
};
export const COUNTRY_SURVEY_YEAR: Record<Country, number> = { sierra_leone: 2016, uganda: 2009 };
export function isCountry(x: string | null | undefined): x is Country {
  return x === "sierra_leone" || x === "uganda";
}
