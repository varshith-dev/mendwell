"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Droplets, Loader2, TriangleAlert, Waves } from "lucide-react";

const OPTIONS = [
  { kind: "working", title: "Water is flowing", sub: "The pump works normally", icon: Droplets, tone: "border-moss/50 hover:bg-moss/10 data-[on=true]:bg-moss/15 data-[on=true]:border-moss" },
  { kind: "low_flow", title: "Weak or slow", sub: "It gives some water, with effort", icon: Waves, tone: "border-ochre/60 hover:bg-ochre/10 data-[on=true]:bg-ochre/15 data-[on=true]:border-ochre" },
  { kind: "broken", title: "Pump is broken", sub: "No water, or the handle is stuck", icon: TriangleAlert, tone: "border-signal/60 hover:bg-signal/10 data-[on=true]:bg-signal/15 data-[on=true]:border-signal" },
] as const;

export function ReportForm({ pumpId }: { pumpId: string }) {
  const [kind, setKind] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function send() {
    if (!kind) return;
    setState("sending");
    const form = document.getElementById("report-form") as HTMLFormElement;
    const website = (new FormData(form).get("website") as string) || "";
    const r = await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pumpId, kind, note: note || undefined, website }) });
    if (r.ok) setState("done");
    else { setMsg((await r.json()).error ?? "Could not send."); setState("error"); }
  }

  return (
    <AnimatePresence mode="wait">
      {state === "done" ? (
        <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="paper-card p-6 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-moss text-paper"><Check className="size-6" /></div>
          <h2 className="mt-4 text-2xl">Thank you</h2>
          <p className="mt-1 text-sm text-ink-2">Your report moves this pump up or down the repair list. Crews plan their day from it.</p>
        </motion.div>
      ) : (
        <motion.form key="form" id="report-form" onSubmit={(e) => { e.preventDefault(); send(); }} className="space-y-3">
          <fieldset className="space-y-2.5">
            <legend className="label-mono mb-2">What is it doing right now?</legend>
            {OPTIONS.map(({ kind: k, title, sub, icon: Icon, tone }) => (
              <button type="button" key={k} data-on={kind === k} aria-pressed={kind === k} onClick={() => setKind(k)}
                className={`flex w-full items-center gap-4 rounded-xl border-2 bg-card p-4 text-left transition active:scale-[0.99] ${tone}`}>
                <Icon className="size-7 shrink-0" />
                <span><span className="block text-lg font-semibold leading-tight">{title}</span><span className="text-sm text-ink-2">{sub}</span></span>
              </button>
            ))}
          </fieldset>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          <label className="block">
            <span className="label-mono">Anything we should know? (optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={2} className="mt-1.5 w-full rounded-lg border border-input bg-card p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="For example: the handle is loose" />
          </label>
          {state === "error" && <p role="alert" className="text-sm text-signal">{msg}</p>}
          <button type="submit" disabled={!kind || state === "sending"} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink text-base font-medium text-paper transition disabled:opacity-40">
            {state === "sending" && <Loader2 className="size-4 animate-spin" />} Send report
          </button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
