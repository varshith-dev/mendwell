import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { OpsNav } from "@/components/site/ops-nav";
import { SignOut } from "@/components/site/sign-out";
import { getSession } from "@/lib/auth";

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1500px] flex-col px-3 pb-10 sm:px-5">
      <header className="sticky top-0 z-30 -mx-3 border-b border-rule bg-paper/90 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex items-center gap-6">
            <Logo href="/board" />
            {s && <div className="hidden md:block"><OpsNav role={s.role} /></div>}
          </div>
          <div className="flex items-center gap-2 text-sm">
            {s ? (
              <>
                <span className="hidden text-ink-2 sm:inline">{s.name}</span>
                <SignOut />
              </>
            ) : (
              <Link href="/login" className="underline underline-offset-4">Sign in</Link>
            )}
          </div>
        </div>
        {s && <div className="mt-2 md:hidden"><OpsNav role={s.role} /></div>}
      </header>
      <main className="flex-1 pt-5">{children}</main>
      <p className="mt-8 border-t border-rule pt-4 text-xs text-ink-2">
        Demo replay: pump conditions come from real national surveys (Sierra Leone 2016, Uganda 2009) and stay hidden from the planner until a technician arrives. Community reports in the seed data are simulated and flagged.
      </p>
    </div>
  );
}
