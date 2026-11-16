import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/site/login-form";
import { Logo } from "@/components/site/logo";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/board";
  if (await getSession()) redirect(safeNext);
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="night-panel relative hidden overflow-hidden !rounded-none lg:block">
        <div className="absolute inset-0 opacity-40 [mask-image:radial-gradient(70%_60%_at_40%_40%,#000,transparent)]">
          <svg viewBox="0 0 800 800" className="size-full" aria-hidden>
            {Array.from({ length: 14 }).map((_, i) => (
              <ellipse key={i} cx="360" cy="380" rx={60 + i * 34} ry={36 + i * 26} fill="none" stroke="#9fe3f2" strokeOpacity={0.5 - i * 0.03} transform={`rotate(${-14 + i * 1.8} 360 380)`} />
            ))}
          </svg>
        </div>
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="[&_span]:!text-[#e9fbff]"><Logo /></div>
          <div>
            <p className="label-mono !text-[#9fe3f2]">Hand pump triage</p>
            <h2 className="display mt-3 max-w-md text-5xl leading-[1.02] text-[#f3eee2]">One in four pumps is down. Find the right one first.</h2>
          </div>
          <p className="max-w-sm text-sm text-[#d6e7ea]/80">Sign in as the demo officer to plan a day for a repair crew, or as the demo technician to run one.</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-3xl">Sign in</h1>
          <p className="mb-6 mt-1 text-sm text-ink-2">Officers plan routes. Technicians run them. Villagers never need an account.</p>
          <LoginForm next={safeNext} />
        </div>
      </div>
    </div>
  );
}
