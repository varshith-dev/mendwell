import Link from "next/link";
import { ArrowRight, ClipboardList, Compass, QrCode } from "lucide-react";
import { HeroMap } from "@/components/site/hero-map";
import { Logo } from "@/components/site/logo";
import { loadBacktest, loadModelCard } from "@/lib/evidence";
import { heroData } from "@/lib/landing";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const hero = heroData();
  const bt = loadBacktest();
  const mc = loadModelCard();
  const session = await getSession();
  const sample = await db.pump.findFirst({ where: { country: "sierra_leone", adm2: "Bombali" }, select: { id: true } });
  const people = bt.countries.sierra_leone.variants.planner.people_per_shift / bt.countries.sierra_leone.variants.nearest.people_per_shift;
  const lift = mc.countries.uganda.lift[0].lift;

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <nav className="flex items-center gap-1 text-sm" aria-label="Main">
          <Link href="/evidence" className="rounded-md px-3 py-1.5 text-ink-2 hover:bg-paper-2">Evidence</Link>
          {sample && <Link href={`/p/${encodeURIComponent(sample.id)}`} className="hidden rounded-md px-3 py-1.5 text-ink-2 hover:bg-paper-2 sm:block">Villager page</Link>}
          <Link href={session ? "/board" : "/login"} className="ml-2 inline-flex h-9 items-center rounded-lg bg-ink px-4 text-paper">{session ? "Open board" : "Sign in"}</Link>
        </nav>
      </header>

      <section className="grid items-center gap-10 pb-16 pt-6 lg:grid-cols-[1.05fr_1fr] lg:pt-14">
        <div>
          <p className="label-mono">Water access · hand pump repair</p>
          <h1 className="mt-4 text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-[4.2rem]">
            Send the repair crew to the pump that <em className="not-italic text-signal">matters</em>.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-2">
            About one hand pump in four is down at any time. Crews usually learn that by driving there. Mendwell ranks every pump by how likely it is broken, plans each technician&apos;s day around the people who need water most, and lets a villager report a dead pump in two taps.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/login" className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-5 text-paper transition hover:-translate-y-0.5 hover:shadow-lg">Open the live demo <ArrowRight className="size-4" /></Link>
            <Link href="/evidence" className="inline-flex h-11 items-center rounded-lg border border-ink/25 px-5 transition hover:bg-paper-2">Read the evidence</Link>
          </div>
          <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-rule pt-6">
            <div><dt className="label-mono">People reached</dt><dd className="reading mt-1 text-3xl">{people.toFixed(1)}×</dd><dd className="text-xs text-ink-2">vs nearest-first, Sierra Leone backtest</dd></div>
            <div><dt className="label-mono">Top 5% lift</dt><dd className="reading mt-1 text-3xl">{lift.toFixed(1)}×</dd><dd className="text-xs text-ink-2">broken pumps found, Uganda</dd></div>
            <div><dt className="label-mono">Real pumps</dt><dd className="reading mt-1 text-3xl">35.5k</dd><dd className="text-xs text-ink-2">two national surveys</dd></div>
          </dl>
        </div>
        <HeroMap data={hero} />
      </section>

      <section className="border-t border-rule py-14" aria-labelledby="how">
        <p className="label-mono">How it works</p>
        <h2 id="how" className="mt-1 max-w-2xl text-3xl sm:text-4xl">Three jobs, one loop</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { n: "01", icon: ClipboardList, t: "Rank", d: "A model trained on 35,000 surveyed pumps scores each one on pump type, age, who manages it, distance to roads and towns, and place. It is scored on districts it never saw. AUC 0.68 to 0.73, with the weak parts shown.", href: "/evidence", cta: "See the model card" },
            { n: "02", icon: Compass, t: "Plan", d: "Pick where the crew starts. The planner chooses stops and order so that, across a shift, the most people get water back. Against a crew that drives to the nearest pump it reaches 2 to 3 times as many.", href: "/login", cta: "Plan a day" },
            { n: "03", icon: QrCode, t: "Report", d: "A sticker with a QR code on each pump opens a page where anyone reports flowing, weak or broken in two taps. No account. The report updates the pump's score the same minute.", href: sample ? `/p/${encodeURIComponent(sample.id)}` : "/login", cta: "Try the villager page" },
          ].map(({ n, icon: Icon, t, d, href, cta }) => (
            <li key={n} className="paper-card flex flex-col p-6">
              <div className="flex items-center justify-between"><span className="reading text-sm text-ink-2">{n}</span><Icon className="size-5 text-lake" /></div>
              <h3 className="mt-6 text-3xl">{t}</h3>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink-2">{d}</p>
              <Link href={href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4">{cta} <ArrowRight className="size-3.5" /></Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-8 border-t border-rule py-14 lg:grid-cols-[1fr_1.1fr]" aria-labelledby="honest">
        <div>
          <p className="label-mono">Honest by design</p>
          <h2 id="honest" className="mt-1 text-3xl sm:text-4xl">We threw out our best score</h2>
        </div>
        <div className="space-y-4 text-ink-2">
          <p>The first model scored 0.99. It was reading a column that is only filled in for working pumps. We removed it, along with two columns computed from the answer, and the honest score fell to 0.68. Most of the planner&apos;s gain turns out to come from routing and from weighting by people served, not from the model. The Evidence page says so, with intervals.</p>
          <p>The surveys behind the demo are from 2016 (Sierra Leone) and 2009 (Uganda). The demo replays them as if they were today, so the planner can be tested against real outcomes. Pump status stays hidden until a technician arrives.</p>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-6 text-xs text-ink-2">
        <span>Built for the Xylem Global Student Innovation Challenge 2026 · Water Access · University track</span>
        <span>Data: Water Point Data Exchange (WPdx+), Sierra Leone Ministry of Water Resources, Uganda Ministry of Water and Environment</span>
      </footer>
    </div>
  );
}
