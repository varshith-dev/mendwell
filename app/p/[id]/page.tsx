import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/site/logo";
import { ReportForm } from "@/components/report/report-form";
import { COUNTRY_LABEL, type Country } from "@/lib/countries";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Report this pump" };

export default async function PumpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pump = await db.pump.findUnique({ where: { id: decodeURIComponent(id) }, select: { id: true, country: true, adm1: true, adm2: true, adm3: true, tech: true, served: true, installYear: true } });
  if (!pump) notFound();
  const recent = await db.report.count({ where: { pumpId: pump.id, createdAt: { gte: new Date(Date.now() - 14 * 86_400_000) } } });
  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-12 pt-5">
      <header className="mb-6 flex items-center justify-between"><Logo /><span className="label-mono">Pump report</span></header>
      <div className="mb-6">
        <p className="label-mono">{COUNTRY_LABEL[pump.country as Country]} · {pump.adm2}{pump.adm3 ? ` · ${pump.adm3}` : ""}</p>
        <h1 className="mt-2 text-4xl leading-[1.05]">Is this pump giving water?</h1>
        <p className="mt-3 text-sm text-ink-2">
          {pump.tech === "Unspecified" ? "Hand pump" : `${pump.tech} hand pump`}
          {pump.installYear ? `, installed ${pump.installYear}` : ""}. About {pump.served.toLocaleString()} people use it.
          {recent > 0 ? ` ${recent} report${recent > 1 ? "s" : ""} in the last two weeks.` : ""}
        </p>
        <p className="reading mt-1 break-all text-[11px] text-ink-2">{pump.id}</p>
      </div>
      <ReportForm pumpId={pump.id} />
      <p className="mt-8 text-center text-xs text-ink-2">No account. No phone number. Your report is only used to decide which pump a repair crew visits first.</p>
    </div>
  );
}
