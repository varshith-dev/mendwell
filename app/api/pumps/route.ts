import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { districtTable, getBeliefs } from "@/lib/data";
import { isCountry } from "@/lib/countries";

/** Columnar belief data for the map. Census status is never included. */
export async function GET(req: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const c = new URL(req.url).searchParams.get("country");
  if (!isCountry(c)) return NextResponse.json({ error: "country must be sierra_leone or uganda" }, { status: 400 });
  const b = await getBeliefs(c);
  return NextResponse.json({
    country: c,
    ids: b.ids,
    lat: b.lat.map((x) => Math.round(x * 1e5) / 1e5),
    lon: b.lon.map((x) => Math.round(x * 1e5) / 1e5),
    belief: b.belief.map((x) => Math.round(x * 1e3) / 1e3),
    served: b.served,
    adm1: b.adm1,
    adm2: b.adm2,
    reports: b.reportCount,
    districts: districtTable(b),
  });
}
