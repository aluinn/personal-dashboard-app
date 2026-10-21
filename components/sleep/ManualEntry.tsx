"use client";

import { useState, useTransition } from "react";
import { deleteManualNight, saveManualNight } from "@/app/health-actions";
import type { Night } from "@/lib/sleep";
import { fmtClock } from "@/lib/sleep";

export type Draft = { night: string; bed: string; wake: string; deep: string; rem: string; core: string; awake: string; imported: boolean; manual: boolean } | null;

export function draftFrom(n: Night): NonNullable<Draft> {
  const m = (h: number) => (h > 0 ? String(Math.round(h * 60)) : "");
  return {
    night: n.date,
    bed: n.bedMin !== null ? fmtClock(n.bedMin) : "23:00",
    wake: n.wakeMin !== null ? fmtClock(n.wakeMin) : "07:00",
    deep: m(n.deepH), rem: m(n.remH), core: m(n.coreH), awake: m(n.awakeH),
    imported: n.source !== "manual",
    manual: n.source === "manual",
  };
}

export default function ManualEntry({ draft, today, onDone }: { draft: Draft; today: string; onDone: () => void }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const d = draft ?? { night: today, bed: "23:00", wake: "07:00", deep: "", rem: "", core: "", awake: "", imported: false, manual: false };
  return (
    <form
      key={`${d.night}-${d.bed}-${d.wake}`}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError("");
        start(async () => {
          try {
            await saveManualNight(f);
            onDone();
          } catch (err) {
            setError((err as Error).message);
          }
        });
      }}
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      <label className="space-y-1">
        <span className="micro">Night (wake-up date)</span>
        <input name="night" type="date" required defaultValue={d.night} max={today} className="field" />
      </label>
      <label className="space-y-1">
        <span className="micro">Fell asleep</span>
        <input name="bed" type="time" required defaultValue={d.bed} className="field" />
      </label>
      <label className="space-y-1">
        <span className="micro">Woke up</span>
        <input name="wake" type="time" required defaultValue={d.wake} className="field" />
      </label>
      <label className="space-y-1">
        <span className="micro">Awake (min)</span>
        <input name="awake" type="number" min={0} defaultValue={d.awake} placeholder="optional" className="field" />
      </label>
      <label className="space-y-1">
        <span className="micro">Deep (min)</span>
        <input name="deep" type="number" min={0} defaultValue={d.deep} placeholder="optional" className="field" />
      </label>
      <label className="space-y-1">
        <span className="micro">REM (min)</span>
        <input name="rem" type="number" min={0} defaultValue={d.rem} placeholder="optional" className="field" />
      </label>
      <label className="space-y-1">
        <span className="micro">Core (min)</span>
        <input name="core" type="number" min={0} defaultValue={d.core} placeholder="optional" className="field" />
      </label>
      <div className="flex items-end gap-2">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save night"}</button>
        {d.manual && (
          <button
            type="button"
            className="micro hover:text-magenta"
            onClick={() => start(async () => { await deleteManualNight(d.night); onDone(); })}
          >
            Remove my entry
          </button>
        )}
      </div>
      {d.imported && <p className="col-span-full text-xs text-muted">This night came from an import. Saving creates your own entry that takes priority; you can remove it later to go back to the imported data.</p>}
      {error && <p className="col-span-full text-xs text-magenta">{error}</p>}
    </form>
  );
}
