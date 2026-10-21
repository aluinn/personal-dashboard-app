"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtClock, fmtHM } from "@/lib/sleep";
import { ChartHeader, TipBox } from "./ChartKit";
import { INK, STAGE, SURFACE, TOTAL, axisProps } from "./theme";

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtDayLong = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const grid = <CartesianGrid stroke={INK.grid} vertical={false} />;
const ANIM = { isAnimationActive: true, animationDuration: 700 } as const;
const cursor = { stroke: "rgba(230,241,240,0.35)", strokeWidth: 1 };

export type DayPoint = {
  date: string;
  asleepH: number | null;
  ma: number | null;
  deepH: number | null;
  coreH: number | null;
  remH: number | null;
  awakeH: number | null;
  unspecH: number | null;
  bed: number | null;
  wake: number | null;
  hr: number | null;
  hrv: number | null;
};

/** 1. Nightly duration (bars) + 7-night average (line) + target. */
export function DurationChart({ data, target }: { data: DayPoint[]; target: number }) {
  const max = Math.max(10, Math.ceil(Math.max(...data.map((d) => d.asleepH ?? 0))) + 1);
  return (
    <>
      <ChartHeader
        title="Nightly sleep"
        sub={`target ${target}h`}
        legend={[
          { color: TOTAL, label: "Asleep per night" },
          { color: INK.primary, label: "7-night average", kind: "line" },
          { color: STAGE.deep, label: `${target}h target`, kind: "line" },
        ]}
      />
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {grid}
            <XAxis dataKey="date" {...axisProps} tickFormatter={fmtDay} minTickGap={28} />
            <YAxis {...axisProps} domain={[0, max]} tickFormatter={(v) => `${v}h`} width={36} />
            <ReferenceLine y={target} stroke={STAGE.deep} strokeWidth={1} />
            <Tooltip
              cursor={cursor}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as DayPoint | undefined;
                if (!active || !p) return null;
                const rows = [];
                if (p.asleepH !== null) rows.push({ color: TOTAL, label: "asleep", value: fmtHM(p.asleepH) });
                if (p.ma !== null) rows.push({ color: INK.primary, label: "7-night average", value: fmtHM(p.ma) });
                if (!rows.length) rows.push({ color: INK.muted, label: "no data", value: "—" });
                return <TipBox title={fmtDayLong(p.date)} rows={rows} />;
              }}
            />
            <Bar dataKey="asleepH" fill={TOTAL} fillOpacity={0.85} maxBarSize={24} radius={[4, 4, 0, 0]} {...ANIM} />
            <Line dataKey="ma" stroke={INK.primary} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: INK.primary, stroke: SURFACE, strokeWidth: 2 }} connectNulls strokeLinecap="round" strokeLinejoin="round" {...ANIM} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

// Round only the top-most visible segment of each stacked bar; 2px surface stroke makes the gaps.
const ORDER = ["deepH", "coreH", "remH", "awakeH", "unspecH"] as const;
function StackSegment(key: (typeof ORDER)[number], color: string) {
  const Seg = (props: { x?: number; y?: number; width?: number; height?: number; payload?: DayPoint }) => {
    const { x = 0, y = 0, width = 0, height = 0, payload } = props;
    if (height <= 0 || width <= 0) return <g />;
    const above = ORDER.slice(ORDER.indexOf(key) + 1).some((k) => (payload?.[k] ?? 0) > 0);
    const r = above ? 0 : Math.min(4, width / 2, height);
    const d = `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
    return <path d={d} fill={color} stroke={SURFACE} strokeWidth={2} />;
  };
  return Seg;
}
const SEGS = { deepH: StackSegment("deepH", STAGE.deep), coreH: StackSegment("coreH", STAGE.core), remH: StackSegment("remH", STAGE.rem), awakeH: StackSegment("awakeH", STAGE.awake), unspecH: StackSegment("unspecH", STAGE.unspec) };

/** 2. Sleep stages, stacked. */
export function StagesChart({ data }: { data: DayPoint[] }) {
  const anyUnspec = data.some((d) => (d.unspecH ?? 0) > 0);
  const legend = [
    { color: STAGE.deep, label: "Deep" },
    { color: STAGE.core, label: "Core" },
    { color: STAGE.rem, label: "REM" },
    { color: STAGE.awake, label: "Awake" },
    ...(anyUnspec ? [{ color: STAGE.unspec, label: "Asleep (no stages)" }] : []),
  ];
  return (
    <>
      <ChartHeader title="Sleep stages" sub="hours per night" legend={legend} />
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {grid}
            <XAxis dataKey="date" {...axisProps} tickFormatter={fmtDay} minTickGap={28} />
            <YAxis {...axisProps} tickFormatter={(v) => `${v}h`} width={36} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as DayPoint | undefined;
                if (!active || !p) return null;
                const rows = [
                  { k: "deepH", c: STAGE.deep, l: "Deep" },
                  { k: "coreH", c: STAGE.core, l: "Core" },
                  { k: "remH", c: STAGE.rem, l: "REM" },
                  { k: "awakeH", c: STAGE.awake, l: "Awake" },
                  { k: "unspecH", c: STAGE.unspec, l: "Asleep (no stages)" },
                ]
                  .filter((r) => (p[r.k as keyof DayPoint] as number | null) !== null && (p[r.k as keyof DayPoint] as number) > 0)
                  .map((r) => ({ color: r.c, label: r.l, value: fmtHM(p[r.k as keyof DayPoint] as number) }));
                return <TipBox title={fmtDayLong(p.date)} rows={rows.length ? rows : [{ color: INK.muted, label: "no stage data", value: "—" }]} />;
              }}
            />
            {(["deepH", "coreH", "remH", "awakeH", "unspecH"] as const).map((k) => (
              <Bar key={k} dataKey={k} stackId="s" maxBarSize={24} shape={SEGS[k] as never} {...ANIM} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

const yTick = (v: number) => fmtClock(v);

/** 3. Bedtime & wake-time scatter on one clock axis (wake = next day), with consistency spread. */
export function ConsistencyChart({ data, bedSd, wakeSd }: { data: DayPoint[]; bedSd: number | null; wakeSd: number | null }) {
  const pts = data.flatMap((d, i) => [
    ...(d.bed !== null ? [{ i, date: d.date, y: d.bed, kind: "bed" }] : []),
    ...(d.wake !== null ? [{ i, date: d.date, y: d.wake + 1440, kind: "wake" }] : []),
  ]);
  const ys = pts.map((p) => p.y);
  const lo = ys.length ? Math.floor((Math.min(...ys) - 30) / 60) * 60 : 1260;
  const hi = ys.length ? Math.ceil((Math.max(...ys) + 30) / 60) * 60 : 1860;
  const dot = (color: string) => {
    const Dot = (props: { cx?: number; cy?: number }) => (
      <g>
        <circle cx={props.cx} cy={props.cy} r={12} fill="transparent" />
        <circle cx={props.cx} cy={props.cy} r={4} fill={color} stroke={SURFACE} strokeWidth={2} />
      </g>
    );
    return Dot;
  };
  return (
    <>
      <ChartHeader
        title="Bedtime & wake-up consistency"
        sub={bedSd !== null && wakeSd !== null ? `bed ±${Math.round(bedSd)} min · wake ±${Math.round(wakeSd)} min` : "needs 3+ nights with times"}
        legend={[
          { color: STAGE.deep, label: "Fell asleep" },
          { color: STAGE.awake, label: "Woke up" },
        ]}
      />
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            {grid}
            <XAxis type="number" dataKey="i" {...axisProps} domain={[0, Math.max(1, data.length - 1)]} tickFormatter={(i) => (data[Math.round(i)] ? fmtDay(data[Math.round(i)].date) : "")} minTickGap={28} />
            <YAxis type="number" dataKey="y" {...axisProps} domain={[lo, hi]} tickFormatter={yTick} width={48} reversed={false} ticks={Array.from({ length: (hi - lo) / 60 + 1 }, (_, k) => lo + k * 60)} />
            <Tooltip
              cursor={{ stroke: "rgba(230,241,240,0.25)", strokeDasharray: "0" }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as { date: string; y: number; kind: string } | undefined;
                if (!active || !p) return null;
                return <TipBox title={fmtDayLong(p.date)} rows={[{ color: p.kind === "bed" ? STAGE.deep : STAGE.awake, label: p.kind === "bed" ? "fell asleep" : "woke up", value: fmtClock(p.y) }]} />;
              }}
            />
            <Scatter data={pts.filter((p) => p.kind === "bed")} shape={dot(STAGE.deep) as never} {...ANIM} />
            <Scatter data={pts.filter((p) => p.kind === "wake")} shape={dot(STAGE.awake) as never} {...ANIM} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/** 4/5. One recovery metric per chart. Never dual-axis: resting HR and HRV sit in two aligned charts
 *  that share a crosshair (syncId), so you can still read them against each other. */
export function RecoveryChart({
  data,
  field,
  title,
  unit,
  color,
}: {
  data: DayPoint[];
  field: "hr" | "hrv";
  title: string;
  unit: string;
  color: string;
}) {
  const vals = data.map((d) => d[field]).filter((v): v is number => v !== null);
  const lo = vals.length ? Math.floor(Math.min(...vals) - 3) : 0;
  const hi = vals.length ? Math.ceil(Math.max(...vals) + 3) : 100;
  const lastIdx = data.map((d) => d[field]).reduce<number>((a, v, i) => (v !== null ? i : a), -1);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  return (
    <>
      <ChartHeader title={title} sub={avg !== null ? `avg ${avg.toFixed(field === "hr" ? 0 : 0)} ${unit}` : undefined} />
      <div className="h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} syncId="recovery" margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            {grid}
            <XAxis dataKey="date" {...axisProps} tickFormatter={fmtDay} minTickGap={28} />
            <YAxis {...axisProps} domain={[lo, hi]} width={36} />
            <Tooltip
              cursor={cursor}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as DayPoint | undefined;
                if (!active || !p) return null;
                const v = p[field];
                return <TipBox title={fmtDayLong(p.date)} rows={[{ color, label: title.toLowerCase(), value: v === null ? "—" : `${Math.round(v)} ${unit}` }]} />;
              }}
            />
            <Area
              dataKey={field}
              stroke={color}
              strokeWidth={2}
              fill={color}
              fillOpacity={0.1}
              strokeLinecap="round"
              strokeLinejoin="round"
              activeDot={{ r: 4, fill: color, stroke: SURFACE, strokeWidth: 2 }}
              dot={(p: { cx?: number; cy?: number; index?: number }) =>
                p.index === lastIdx && p.cx !== undefined ? <circle key="end" cx={p.cx} cy={p.cy} r={4} fill={color} stroke={SURFACE} strokeWidth={2} /> : <g key={p.index} />
              }
              {...ANIM}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
