"use client";

import { useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ChartHeader, TipBox } from "@/components/sleep/ChartKit";
import { INK, SURFACE, TOTAL, axisProps } from "@/components/sleep/theme";
import { MUSCLES } from "@/lib/exercises";
import { tonnes, type HeatCell, type LiftPoint } from "@/lib/workouts";

export const PR_COLOR = "#ffb347";
const grid = <CartesianGrid stroke={INK.grid} vertical={false} />;
const ANIM = { isAnimationActive: true, animationDuration: 700 } as const;
const cursor = { stroke: "rgba(230,241,240,0.35)", strokeWidth: 1 };
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtDayLong = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const kg = (n: number) => `${Math.round(n * 10) / 10} kg`;

/** Estimated 1RM per session for one lift (Epley). PRs get a larger amber marker. */
export function StrengthChart({ points, name }: { points: LiftPoint[]; name: string }) {
  const vals = points.map((p) => p.e1rm);
  const lo = vals.length ? Math.floor(Math.min(...vals) - 5) : 0;
  const hi = vals.length ? Math.ceil(Math.max(...vals) + 5) : 100;
  const last = points.length - 1;
  return (
    <>
      <ChartHeader
        title={`${name}: estimated 1RM`}
        sub="Epley, best set of 1–12 reps per session"
        legend={[
          { color: TOTAL, label: "Estimated 1RM", kind: "line" },
          { color: PR_COLOR, label: "New PR" },
        ]}
      />
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 14, right: 16, bottom: 0, left: 0 }}>
            {grid}
            <XAxis dataKey="date" {...axisProps} tickFormatter={fmtDay} minTickGap={30} />
            <YAxis {...axisProps} domain={[lo, hi]} tickFormatter={(v) => `${v}`} width={36} />
            <Tooltip
              cursor={cursor}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as LiftPoint | undefined;
                if (!active || !p) return null;
                return (
                  <TipBox
                    title={`${fmtDayLong(p.date)}${p.isPR ? "  ·  NEW PR" : ""}`}
                    rows={[
                      { color: TOTAL, label: "estimated 1RM", value: kg(p.e1rm) },
                      { color: INK.muted, label: "best set", value: `${p.weightKg} kg × ${p.reps}` },
                    ]}
                  />
                );
              }}
            />
            <Line
              dataKey="e1rm"
              stroke={TOTAL}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              connectNulls
              activeDot={{ r: 5, fill: TOTAL, stroke: SURFACE, strokeWidth: 2 }}
              dot={(d: { cx?: number; cy?: number; index?: number; payload?: LiftPoint }) => {
                const { cx, cy, index = 0, payload } = d;
                if (cx === undefined || cy === undefined) return <g key={index} />;
                if (payload?.isPR)
                  return (
                    <g key={index}>
                      <circle cx={cx} cy={cy} r={7} fill={PR_COLOR} stroke={SURFACE} strokeWidth={2} />
                      <text x={cx} y={cy - 12} textAnchor="middle" fontSize={9} fontFamily="var(--font-jetbrains), monospace" fill={PR_COLOR}>PR</text>
                    </g>
                  );
                return <circle key={index} cx={cx} cy={cy} r={index === last ? 4 : 3} fill={TOTAL} stroke={SURFACE} strokeWidth={2} />;
              }}
              {...ANIM}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function WeeklyVolumeChart({ data }: { data: { weekStart: string; volumeKg: number; sessions: number }[] }) {
  const rows = data.map((d) => ({ ...d, t: d.volumeKg / 1000 }));
  return (
    <>
      <ChartHeader title="Weekly volume" sub="sets × reps × kg, tonnes per week" />
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {grid}
            <XAxis dataKey="weekStart" {...axisProps} tickFormatter={fmtDay} minTickGap={24} />
            <YAxis {...axisProps} width={36} tickFormatter={(v) => `${v}t`} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (!active || !p) return null;
                return (
                  <TipBox
                    title={`Week of ${fmtDay(p.weekStart)}`}
                    rows={[
                      { color: TOTAL, label: "volume", value: tonnes(p.volumeKg) },
                      { color: INK.muted, label: "workouts", value: String(p.sessions) },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="t" fill={TOTAL} fillOpacity={0.85} maxBarSize={24} radius={[4, 4, 0, 0]} {...ANIM} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function MuscleRadar({ sets, days }: { sets: Record<string, number>; days: number }) {
  const data = MUSCLES.map((m) => ({ muscle: m.label, sets: sets[m.key] ?? 0 }));
  const total = data.reduce((a, d) => a + d.sets, 0);
  const max = Math.max(5, ...data.map((d) => d.sets));
  return (
    <>
      <ChartHeader title="Muscle-group balance" sub={`hard sets, last ${days} days`} />
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Log some strength sessions and your balance shows up here.</p>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="72%">
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
              <PolarAngleAxis dataKey="muscle" tick={{ fill: INK.muted, fontSize: 10, fontFamily: "var(--font-jetbrains), monospace" }} />
              <Tooltip
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as { muscle: string; sets: number } | undefined;
                  if (!active || !p) return null;
                  return <TipBox title={p.muscle} rows={[{ color: TOTAL, label: "hard sets", value: String(p.sets) }]} />;
                }}
              />
              <Radar dataKey="sets" stroke={TOTAL} strokeWidth={2} fill={TOTAL} fillOpacity={0.18} dot={{ r: 3, fill: TOTAL, stroke: SURFACE, strokeWidth: 2 }} {...ANIM} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
      {total > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
          {[...data].sort((a, b) => b.sets - a.sets).map((d) => (
            <li key={d.muscle} className="flex items-center gap-3 text-xs">
              <span className="w-28 shrink-0 text-muted">{d.muscle}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <span className="block h-full rounded-full" style={{ width: `${(d.sets / max) * 100}%`, background: TOTAL, opacity: 0.85 }} />
              </span>
              <span className="w-16 text-right font-mono">{d.sets} <span className="text-muted">{Math.round((d.sets / total) * 100)}%</span></span>
            </li>
          ))}
          <li className="micro normal-case tracking-wide">
            {(() => {
              const sorted = [...data].sort((a, b) => b.sets - a.sets);
              const lo = sorted[sorted.length - 1];
              const hi = sorted[0];
              return lo.sets === 0 ? `Nothing logged for ${lo.muscle.toLowerCase()} in ${days} days.` : `${hi.muscle} gets ${(hi.sets / lo.sets).toFixed(1)}× the sets of ${lo.muscle.toLowerCase()}.`;
            })()}
          </li>
        </ul>
      )}
    </>
  );
}

export function BodyChart({ points, unit, label }: { points: { date: string; value: number }[]; unit: string; label: string }) {
  const vals = points.map((p) => p.value);
  const lo = vals.length ? Math.floor(Math.min(...vals) - 1) : 0;
  const hi = vals.length ? Math.ceil(Math.max(...vals) + 1) : 100;
  const color = "#9b8cff";
  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          {grid}
          <XAxis dataKey="date" {...axisProps} tickFormatter={fmtDay} minTickGap={30} />
          <YAxis {...axisProps} domain={[lo, hi]} width={36} />
          <Tooltip
            cursor={cursor}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as { date: string; value: number } | undefined;
              if (!active || !p) return null;
              return <TipBox title={fmtDayLong(p.date)} rows={[{ color, label: label.toLowerCase(), value: `${p.value} ${unit}` }]} />;
            }}
          />
          <Area dataKey="value" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.1} strokeLinecap="round" strokeLinejoin="round" activeDot={{ r: 4, fill: color, stroke: SURFACE, strokeWidth: 2 }} dot={{ r: 3, fill: color, stroke: SURFACE, strokeWidth: 2 }} {...ANIM} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---- heatmap (SVG, teal glow) -------------------------------------------
const LEVEL_FILL = ["rgba(255,255,255,0.05)", "#134e4a", "#14766f", "#1fb5a8", "#2ee6d6"];
const CELL = 14;
const GAP = 3;

export function Heatmap({ cells }: { cells: HeatCell[][] }) {
  const [tip, setTip] = useState<{ c: HeatCell; x: number; y: number } | null>(null);
  const W = cells.length * (CELL + GAP) + 28;
  const H = 7 * (CELL + GAP) + 18;
  const months = cells.map((col, i) => {
    const d = new Date(`${col[0].date}T00:00:00Z`);
    const prev = i > 0 ? new Date(`${cells[i - 1][0].date}T00:00:00Z`) : null;
    return !prev || prev.getUTCMonth() !== d.getUTCMonth() ? d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }) : "";
  });
  const total = cells.flat().filter((c) => c.level > 0).length;
  return (
    <>
      <ChartHeader title="Consistency" sub={`${total} active days in ${cells.length} weeks`} />
      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Training consistency heatmap" className="block h-auto w-full" style={{ maxHeight: 220 }} preserveAspectRatio="xMinYMid meet">
          <defs>
            <filter id="hmGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {["Mon", "Wed", "Fri"].map((d, i) => (
            <text key={d} x={0} y={18 + i * 2 * (CELL + GAP) + CELL - 3} fontSize={9} fill={INK.muted} fontFamily="var(--font-jetbrains), monospace">{d}</text>
          ))}
          {months.map((m, i) => (m ? <text key={i} x={28 + i * (CELL + GAP)} y={9} fontSize={9} fill={INK.muted} fontFamily="var(--font-jetbrains), monospace">{m}</text> : null))}
          {cells.map((col, w) =>
            col.map((c, r) =>
              c.future ? null : (
                <rect
                  key={c.date}
                  x={28 + w * (CELL + GAP)}
                  y={16 + r * (CELL + GAP)}
                  width={CELL}
                  height={CELL}
                  rx={3}
                  fill={LEVEL_FILL[c.level]}
                  filter={c.level >= 3 ? "url(#hmGlow)" : undefined}
                  onPointerEnter={(e) => setTip({ c, x: e.clientX, y: e.clientY })}
                  onPointerMove={(e) => setTip({ c, x: e.clientX, y: e.clientY })}
                  onPointerLeave={() => setTip(null)}
                  className="transition-opacity hover:opacity-80"
                />
              ),
            ),
          )}
        </svg>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <span className="micro">less</span>
        {LEVEL_FILL.map((f, i) => (
          <span key={i} className="h-3 w-3 rounded-[3px]" style={{ background: f, boxShadow: i >= 3 ? `0 0 6px ${f}` : undefined }} />
        ))}
        <span className="micro">more</span>
      </div>
      {tip && (
        <div className="pointer-events-none fixed z-50" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          <TipBox
            title={fmtDayLong(tip.c.date)}
            rows={
              tip.c.sessions === 0
                ? [{ color: INK.muted, label: "rest day", value: "—" }]
                : [
                    { color: LEVEL_FILL[tip.c.level], label: tip.c.sessions === 1 ? "workout" : "workouts", value: String(tip.c.sessions) },
                    ...(tip.c.volumeKg > 0 ? [{ color: TOTAL, label: "volume", value: tonnes(tip.c.volumeKg) }] : []),
                    ...(tip.c.minutes > 0 ? [{ color: INK.muted, label: "time", value: `${Math.round(tip.c.minutes)} min` }] : []),
                  ]
            }
          />
        </div>
      )}
    </>
  );
}
