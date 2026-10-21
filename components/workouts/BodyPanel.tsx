"use client";

import { useState, useTransition } from "react";
import { deleteBodyMetric, saveBodyMetrics } from "@/app/workout-actions";
import type { BodyRow } from "@/lib/db/workouts";
import { BodyChart } from "./WorkoutCharts";

const METRICS = [
  { key: "weight", label: "Bodyweight", unit: "kg", step: "0.1" },
  { key: "bodyfat", label: "Body fat", unit: "%", step: "0.1" },
  { key: "waist", label: "Waist", unit: "cm", step: "0.5" },
  { key: "chest", label: "Chest", unit: "cm", step: "0.5" },
  { key: "arm", label: "Arm", unit: "cm", step: "0.5" },
  { key: "thigh", label: "Thigh", unit: "cm", step: "0.5" },
  { key: "hips", label: "Hips", unit: "cm", step: "0.5" },
];

export default function BodyPanel({ rows, today }: { rows: BodyRow[]; today: string }) {
  const [metric, setMetric] = useState("weight");
  const [date, setDate] = useState(today);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const m = METRICS.find((x) => x.key === metric)!;
  const series = rows.filter((r) => r.metric === metric).map((r) => ({ date: r.date, value: r.value }));
  const latest = series[series.length - 1];
  const first = series[0];
  const have = new Set(rows.map((r) => r.metric));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {METRICS.map((x) => (
          <button key={x.key} onClick={() => setMetric(x.key)} className={`micro rounded-sm border px-2.5 py-1.5 ${metric === x.key ? "border-violet/70 bg-violet/15 text-text" : "border-line hover:border-violet/40"} ${!have.has(x.key) && metric !== x.key ? "opacity-50" : ""}`}>
            {x.label}
          </button>
        ))}
      </div>

      {series.length > 0 ? (
        <>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-3xl font-light text-teal glow-text">{latest.value}<span className="text-base text-muted"> {m.unit}</span></span>
            {series.length > 1 && (
              <span className="micro normal-case tracking-wide">
                {latest.value - first.value >= 0 ? "+" : ""}{(latest.value - first.value).toFixed(1)} {m.unit} since {first.date}
              </span>
            )}
          </div>
          <BodyChart points={series} unit={m.unit} label={m.label} />
        </>
      ) : (
        <p className="text-sm text-muted">No {m.label.toLowerCase()} entries yet. Log one below. Everything here is optional.</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          start(async () => {
            try {
              await saveBodyMetrics(date, vals);
              setVals({});
            } catch (err) {
              setError((err as Error).message);
            }
          });
        }}
        className="grid grid-cols-2 gap-2 border-t border-line pt-3 sm:grid-cols-4"
      >
        <label className="col-span-2 space-y-1 sm:col-span-4">
          <span className="micro">Date</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="field" />
        </label>
        {METRICS.map((x) => (
          <label key={x.key} className="space-y-1">
            <span className="micro">{x.label} ({x.unit})</span>
            <input type="number" inputMode="decimal" step={x.step} min={0} value={vals[x.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [x.key]: e.target.value }))} className="field" />
          </label>
        ))}
        <div className="flex items-end"><button className="btn w-full !py-2.5" disabled={pending}>{pending ? "Saving…" : "Save"}</button></div>
        {error && <p className="col-span-full text-xs text-magenta">{error}</p>}
      </form>

      {series.length > 0 && (
        <ul className="max-h-32 divide-y divide-line overflow-auto text-xs">
          {[...series].reverse().slice(0, 12).map((r) => (
            <li key={r.date} className="flex items-center justify-between py-1.5">
              <span className="font-mono text-muted">{r.date}</span>
              <span className="font-mono">{r.value} {m.unit}</span>
              <button className="micro hover:text-magenta" onClick={() => start(async () => { await deleteBodyMetric(r.date, metric); })}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
