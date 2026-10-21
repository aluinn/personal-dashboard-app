"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import CountUp from "@/components/ui/CountUp";
import Panel from "@/components/ui/Panel";
import { saveSleepTarget } from "@/app/health-actions";
import {
  buildNights, computeStats, dayRange, fmtClock, fmtHM, movingAverage, pickByDay, scoresFor, terrainGrid,
  type HrRow, type HrvRow, type Night, type SleepRow,
} from "@/lib/sleep";
import { londonToday } from "@/lib/time";
import { HRV_COLOR, HR_COLOR, INK, STAGE } from "./theme";
import { ConsistencyChart, DurationChart, RecoveryChart, StagesChart, type DayPoint } from "./SleepCharts";
import ManualEntry, { draftFrom, type Draft } from "./ManualEntry";
import ScoreRing from "./ScoreRing";
import TerrainLoader from "./TerrainLoader";
import type { TerrainHover } from "./SleepTerrain";

const RANGES = [
  { key: "7", label: "7D", days: 7 },
  { key: "30", label: "30D", days: 30 },
  { key: "90", label: "90D", days: 90 },
  { key: "all", label: "All", days: null },
] as const;

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function Tile({ label, children, hint, delay = 0 }: { label: string; children: React.ReactNode; hint?: string; delay?: number }) {
  return (
    <Panel label={label} delay={delay} className="!p-3">
      <div className="font-mono text-2xl font-light text-teal glow-text">{children}</div>
      {hint && <div className="micro mt-1 normal-case tracking-wide">{hint}</div>}
    </Panel>
  );
}

export default function SleepView({ rows, hr, hrv, target }: { rows: SleepRow[]; hr: HrRow[]; hrv: HrvRow[]; target: number }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30");
  const [hover, setHover] = useState<TerrainHover>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [showTable, setShowTable] = useState(false);
  const [tgt, setTgt] = useState(String(target));
  const [, startT] = useTransition();
  const today = londonToday();
  const entryRef = useRef<HTMLDivElement>(null);

  const nights = useMemo(() => buildNights(rows), [rows]);
  const scores = useMemo(() => scoresFor(nights, target), [nights, target]);

  const model = useMemo(() => {
    if (nights.length === 0) return null;
    const first = nights[0].date;
    const end = nights[nights.length - 1].date;
    const byDate = new Map(nights.map((n) => [n.date, n]));
    const allDays = dayRange(end, null, first);
    const hrBy = pickByDay(hr);
    const hrvBy = pickByDay(hrv);
    const durs = allDays.map((d) => byDate.get(d)?.asleepH ?? null);
    const ma = movingAverage(durs, 7); // computed over the full history so the left edge of a range is right
    const full: DayPoint[] = allDays.map((d, i) => {
      const n = byDate.get(d);
      return {
        date: d, asleepH: n?.asleepH ?? null, ma: ma[i],
        deepH: n ? n.deepH : null, coreH: n ? n.coreH : null, remH: n ? n.remH : null, awakeH: n ? n.awakeH : null, unspecH: n ? n.unspecH : null,
        bed: n?.bedMin ?? null, wake: n?.wakeMin ?? null,
        hr: hrBy.get(d)?.resting ?? null, hrv: hrvBy.get(d)?.avg ?? null,
      };
    });
    return { full, allDays, byDate, end };
  }, [nights, hr, hrv]);

  if (!model) {
    return (
      <div className="space-y-4">
        <Panel label="SLEEP // NO DATA YET" accent="violet">
          <p className="mb-3 max-w-xl text-sm text-muted">
            Nothing to show yet. Import your Apple Health export (or a Health Auto Export file) in Settings, or log a night by hand below. The terrain, charts and score appear as soon as there’s data.
          </p>
          <Link href="/settings" className="btn inline-block">Go to import</Link>
        </Panel>
        <Panel label="LOG A NIGHT">
          <ManualEntry draft={null} today={today} onDone={() => {}} />
        </Panel>
      </div>
    );
  }

  const r = RANGES.find((x) => x.key === range)!;
  const rangeDays = r.days;
  const data = rangeDays ? model.full.slice(-rangeDays) : model.full;
  const inRange = data.map((d) => model.byDate.get(d.date)).filter((n): n is Night => !!n);
  const stats = computeStats(inRange, data.map((d) => d.date), target, scores);
  const latest = nights[nights.length - 1];
  const latestScore = scores.get(latest.date) ?? null;

  // terrain follows the range, clamped to 30-90 nights
  const tDays = Math.min(90, Math.max(30, rangeDays ?? model.allDays.length));
  const tData = model.full.slice(-tDays);
  const tVals = tData.map((d) => d.asleepH);
  const grid = terrainGrid(tVals, 16);
  const has = tVals.map((v) => v !== null);

  const hoverText = hover && tData[hover.col] ? { d: tData[hover.col], row: hover.row } : null;

  const edit = (n: Night) => {
    setDraft(draftFrom(n));
    entryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-4">
      {/* filters: one row above everything they scope */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex gap-1 rounded-sm border border-line p-1" role="tablist" aria-label="Date range">
          {RANGES.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={range === x.key}
              onClick={() => setRange(x.key)}
              className={`micro relative z-10 px-3 py-1.5 transition-colors ${range === x.key ? "text-teal" : "hover:text-text"}`}
            >
              {range === x.key && <motion.span layoutId="range-pill" className="absolute inset-0 -z-10 rounded-[2px] bg-teal/12 ring-1 ring-teal/40" />}
              {x.label}
            </button>
          ))}
        </div>
        <span className="micro">ending {fmtDate(model.end)} · {stats.count} night{stats.count === 1 ? "" : "s"}</span>
        <label className="micro ml-auto flex items-center gap-2">
          Target
          <input
            type="number" min={4} max={12} step={0.25} value={tgt} aria-label="Sleep target in hours"
            onChange={(e) => setTgt(e.target.value)}
            onBlur={() => { const n = Number(tgt); if (Number.isFinite(n) && n !== target) startT(() => saveSleepTarget(n)); }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="field !w-16 text-center"
          />
          h
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Panel label={`TERRAIN // LAST ${tDays} NIGHTS`} meta="drag to orbit" accent="violet" className="min-h-[420px] xl:col-span-8">
          <div className="absolute inset-0 top-9">
            <TerrainLoader grid={grid} has={has} target={target} hover={hover} onHover={setHover} />
          </div>
          {hoverText && hover && (
            <div className="pointer-events-none absolute z-20 rounded-sm border border-line bg-[#0a1115]/95 px-3 py-2 backdrop-blur" style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 36 }}>
              <div className="micro mb-1">{fmtDate(hoverText.d.date)}</div>
              <div className="font-mono text-sm text-text">{hoverText.d.asleepH === null ? "no data" : fmtHM(hoverText.d.asleepH)}</div>
              {hoverText.row > 0 && <div className="text-[11px] text-muted">row {hoverText.row + 1}: average of ±{hoverText.row} nights</div>}
            </div>
          )}
          <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex justify-between">
            <span className="micro">{fmtDate(tData[0].date)}</span>
            <span className="micro text-center normal-case tracking-wide">height = hours asleep · front row = actual nights, rows behind = smoother averages</span>
            <span className="micro">{fmtDate(tData[tData.length - 1].date)}</span>
          </div>
        </Panel>

        <div className="grid gap-4 xl:col-span-4">
          <Panel label="SLEEP SCORE" delay={0.05}>
            <ScoreRing score={latestScore} label={`Last night · ${fmtDate(latest.date)}`} sub={stats.avgScore !== null ? `average ${stats.avgScore} over this range` : undefined} />
            <p className="mt-3 text-center text-[11px] leading-snug text-muted">
              Duration vs target 50% · deep+REM share 25% · efficiency 15% · bedtime regularity 10%. Missing data is left out, not penalised.
            </p>
          </Panel>
          <div className="grid grid-cols-2 gap-4">
            <Tile label="AVG SLEEP" delay={0.1} hint={stats.avgH !== null ? `${stats.avgH >= target ? "+" : "−"}${fmtHM(Math.abs(stats.avgH - target))} vs target` : undefined}>
              {stats.avgH === null ? "–" : <CountUp to={stats.avgH} decimals={1} suffix="h" />}
            </Tile>
            <Tile label="SLEEP DEBT" delay={0.12} hint={`last 7 nights vs ${target}h`}>
              <CountUp to={stats.debtH} decimals={1} suffix="h" />
            </Tile>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="CONSISTENCY" delay={0.15} hint={stats.bedSd !== null ? `bed ±${Math.round(stats.bedSd)}m · wake ±${Math.round(stats.wakeSd ?? 0)}m` : "needs 3+ nights"}>
          {stats.consistency === null ? "–" : <CountUp to={stats.consistency} suffix="/100" />}
        </Tile>
        <Tile label="BEST NIGHT" delay={0.17} hint={stats.best ? fmtDate(stats.best.date) : undefined}>
          {stats.best ? fmtHM(stats.best.asleepH) : "–"}
        </Tile>
        <Tile label="WORST NIGHT" delay={0.19} hint={stats.worst ? fmtDate(stats.worst.date) : undefined}>
          {stats.worst ? fmtHM(stats.worst.asleepH) : "–"}
        </Tile>
        <Tile label="STREAK" delay={0.21} hint={`nights ≥ ${stats.threshold}h · longest ${stats.longest}`}>
          <CountUp to={stats.streak} suffix={stats.streak === 1 ? " night" : " nights"} />
        </Tile>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel label="DURATION" className="xl:col-span-2">
          <DurationChart data={data} target={target} />
        </Panel>
        <Panel label="STAGES">
          <StagesChart data={data} />
        </Panel>
        <Panel label="REGULARITY">
          <ConsistencyChart data={data} bedSd={stats.bedSd} wakeSd={stats.wakeSd} />
        </Panel>
        <Panel label="RECOVERY // RESTING HEART RATE">
          <RecoveryChart data={data} field="hr" title="Resting heart rate" unit="bpm" color={HR_COLOR} />
        </Panel>
        <Panel label="RECOVERY // HRV (SDNN)">
          <RecoveryChart data={data} field="hrv" title="Heart rate variability" unit="ms" color={HRV_COLOR} />
        </Panel>
      </div>
      <p className="micro normal-case tracking-wide">Resting HR and HRV are shown as two aligned charts with a shared crosshair rather than one dual-axis chart, because two scales on one plot make the lines look related when they aren’t.</p>

      <div className="grid gap-4 xl:grid-cols-2">
        <div ref={entryRef}>
          <Panel label="LOG OR FIX A NIGHT" accent="violet">
            <ManualEntry draft={draft} today={today} onDone={() => setDraft(null)} />
          </Panel>
        </div>
        <Panel label="NIGHTS // TABLE VIEW" meta={<button className="hover:text-teal" onClick={() => setShowTable((v) => !v)}>{showTable ? "collapse" : "expand"}</button>}>
          <div className={`overflow-auto ${showTable ? "max-h-[520px]" : "max-h-[220px]"}`}>
            <table className="w-full text-left text-xs">
              <thead className="micro sticky top-0 bg-[#0a1115]">
                <tr>
                  {["Night", "Asleep", "Deep", "REM", "Bed", "Wake", "Source", ""].map((h) => (
                    <th key={h} className="px-2 py-1.5 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono">
                {[...inRange].reverse().map((n) => (
                  <tr key={n.date} className="border-t border-line">
                    <td className="px-2 py-1.5">{fmtDate(n.date)}</td>
                    <td className="px-2 py-1.5 text-teal">{fmtHM(n.asleepH)}</td>
                    <td className="px-2 py-1.5" style={{ color: n.hasStages ? STAGE.deep : INK.muted }}>{n.hasStages ? fmtHM(n.deepH) : "–"}</td>
                    <td className="px-2 py-1.5" style={{ color: n.hasStages ? STAGE.rem : INK.muted }}>{n.hasStages ? fmtHM(n.remH) : "–"}</td>
                    <td className="px-2 py-1.5">{n.bedMin !== null ? fmtClock(n.bedMin) : "–"}</td>
                    <td className="px-2 py-1.5">{n.wakeMin !== null ? fmtClock(n.wakeMin) : "–"}</td>
                    <td className="px-2 py-1.5 text-muted">{n.source}</td>
                    <td className="px-2 py-1.5"><button className="micro hover:text-teal" onClick={() => edit(n)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
