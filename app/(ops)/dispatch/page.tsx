import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Planner } from "@/components/dispatch/planner";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dispatch" };

export default async function DispatchPage({ searchParams }: { searchParams: Promise<{ country?: string; lat?: string; lon?: string }> }) {
  const s = await requireUser("/dispatch");
  if (s.role !== "officer") redirect("/routes");
  const q = await searchParams;
  const lat = q.lat ? Number(q.lat) : undefined;
  const lon = q.lon ? Number(q.lon) : undefined;
  return <Planner country={q.country === "uganda" ? "uganda" : "sierra_leone"} lat={Number.isFinite(lat) ? lat : undefined} lon={Number.isFinite(lon) ? lon : undefined} />;
}
