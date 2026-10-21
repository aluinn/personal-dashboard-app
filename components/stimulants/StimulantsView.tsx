"use client";

import { useState, useTransition } from "react";
import Panel from "@/components/ui/Panel";
import { deleteStimulant, logStimulant, saveStimulantSettings } from "@/app/stimulant-actions";
import { caffeineWindow, type StimSettings } from "@/lib/stimulants";
import { addDays, formatDay, londonDate } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import type { StimLog } from "@/lib/db/stimulants";
import QuickLog from "./QuickLog";

const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });

export default function StimulantsView({ logs, settings, wakeAt }: { logs: StimLog[]; settings: StimSettings; wakeAt: number | null }) {
  const now = useNow(30000);
  const [pending, start] = useTransition();
  const [label, setLabel] = useState("");
  const [mg, setMg] = useState("");
  const [kind, setKind] = useState<"caffeine" | "nicotine">("caffeine");
  if (now === null) return <div className="micro">Loading…</div>;

  const today = londonDate(now);
  const win = caffeineWindow(now, today, wakeAt, settings);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const perDay = new Map<string, { caf: number; nic: number }>();
  for (const l of logs) {
    const d = londonDate(l.at);
    const cur = perDay.get(d) ?? { caf: 0, nic: 0 };
    if (l.kind === "caffeine") cur.caf += l.mg;
    else cur.nic += 1;
    perDay.set(d, cur);
  }
  const top = Math.max(settings.maxMg, ...days.map((d) => perDay.get(d)?.caf ?? 0));
  const todays = logs.filter((l) => londonDate(l.at) === today);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel label="WINDOW // RIGHT NOW" accent="violet">
        <div className={`font-mono text-xl ${win.state === "closed" ? "text-magenta" : win.state === "open" ? "text-teal" : ""}`}>{win.text}</div>
        <p className="micro mt-2 normal-case tracking-wide">
          Opens {settings.delayMin} min after you wake{wakeAt ? ` (woke ${clock(wakeAt)})` : " (no wake time from today's sleep data yet)"}; closes at {settings.cutoff}.
        </p>
        <div className="mt-4"><QuickLog /></div>
        <form
          className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await logStimulant(kind, label || (kind === "caffeine" ? "Caffeine" : "Nicotine"), Number(mg));
              setLabel("");
              setMg("");
            });
          }}
        >
          <select value={kind} onChange={(e) => setKind(e.target.value as "caffeine" | "nicotine")} className="field !w-28">
            <option value="caffeine">Caffeine</option>
            <option value="nicotine">Nicotine</option>
          </select>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What (optional)" className="field !w-40" />
          <input value={mg} onChange={(e) => setMg(e.target.value)} type="number" min={1} step="any" required placeholder="mg" className="field !w-20" />
          <button className="btn" disabled={pending}>Log custom</button>
        </form>
      </Panel>

      <Panel label="TODAY">
        {todays.length === 0 ? (
          <p className="text-sm text-muted">Nothing logged today.</p>
        ) : (
          <ul className="divide-y divide-line">
            {todays.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                <span><span className="font-mono text-teal">{clock(l.at)}</span> {l.label || l.kind} <span className="micro">{l.mg} mg {l.kind}</span></span>
                <button className="micro hover:text-magenta" onClick={() => start(() => deleteStimulant(l.id))}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel label="CAFFEINE // LAST 14 DAYS" className="xl:col-span-2">
        <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Daily caffeine for the last 14 days">
          {days.map((d) => {
            const v = perDay.get(d)?.caf ?? 0;
            return (
              <div key={d} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${formatDay(d)}: ${Math.round(v)} mg caffeine, ${perDay.get(d)?.nic ?? 0} nicotine`}>
                <div className="w-full max-w-6 rounded-t-[4px]" style={{ height: `${(v / top) * 100}%`, minHeight: v ? 2 : 0, background: v > settings.maxMg ? "#e052ff" : "#2ee6d6" }} />
                <span className="micro !text-[9px]">{d.slice(8)}</span>
              </div>
            );
          })}
        </div>
        <p className="micro mt-2 normal-case tracking-wide">Magenta = over your {settings.maxMg} mg daily limit. Amounts are typical values; edit them when you log if yours differ.</p>
      </Panel>

      <Panel label="SETTINGS" className="xl:col-span-2">
        <form action={saveStimulantSettings} className="flex flex-wrap items-end gap-3">
          <label className="space-y-1"><span className="micro">Caffeine cut-off</span><input name="cutoff" type="time" defaultValue={settings.cutoff} className="field !w-32" /></label>
          <label className="space-y-1"><span className="micro">Wait after waking (min)</span><input name="delayMin" type="number" min={0} max={240} defaultValue={settings.delayMin} className="field !w-32" /></label>
          <label className="space-y-1"><span className="micro">Daily limit (mg)</span><input name="maxMg" type="number" min={50} max={1000} defaultValue={settings.maxMg} className="field !w-32" /></label>
          <button className="btn">Save</button>
        </form>
      </Panel>
    </div>
  );
}
