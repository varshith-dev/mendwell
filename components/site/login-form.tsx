"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMOS = [
  { label: "Officer (plan routes)", email: "officer@mendwell.demo", next: "/board" },
  { label: "Technician (field view)", email: "tech@mendwell.demo", next: "/route/demo-route" },
];

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e?: React.FormEvent, creds?: { email: string; password: string; next?: string }) {
    e?.preventDefault();
    setBusy(true); setErr("");
    const body = creds ?? { email, password };
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Could not sign in."); setBusy(false); return; }
    router.push(creds?.next ?? (j.role === "technician" && next === "/board" ? "/routes" : next));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 bg-card" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 bg-card" />
        </div>
        {err && <p role="alert" className="text-sm text-signal">{err}</p>}
        <Button type="submit" size="lg" className="h-10 w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Sign in</Button>
      </form>
      <div>
        <div className="flex items-center gap-3"><span className="fig-rule flex-1" /><span className="label-mono">Try the demo</span><span className="fig-rule flex-1" /></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {DEMOS.map((d) => (
            <Button key={d.email} type="button" variant="outline" className="h-auto flex-col items-start gap-0.5 py-2.5 text-left" disabled={busy}
              onClick={() => submit(undefined, { email: d.email, password: "mendwell-demo", next: d.next })}>
              <span className="font-medium">{d.label}</span>
              <span className="reading text-[11px] font-normal text-ink-2">{d.email}</span>
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-2">Demo password for both: <span className="reading">mendwell-demo</span></p>
      </div>
    </div>
  );
}
