"use client";

import type { ReactNode } from "react";
import { INK } from "./theme";

export type TipRow = { color: string; label: string; value: string };

/** Tooltip body: values lead (bold, primary), series names follow (muted), keyed with a short line. */
export function TipBox({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="rounded-sm border border-line bg-[#0a1115]/95 px-3 py-2 shadow-lg backdrop-blur">
      <div className="micro mb-1.5">{title}</div>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            <span className="h-[2px] w-3.5 rounded-full" style={{ background: r.color }} />
            <span className="font-mono text-sm font-medium text-text">{r.value}</span>
            <span className="text-[11px] text-muted">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type LegendItem = { color: string; label: string; kind?: "rect" | "line" };

/** Always present for 2+ series; the mark shape mirrors the chart (rect for bars, line for lines). */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-[11px] text-muted">
          <span
            className={i.kind === "line" ? "h-[2px] w-4 rounded-full" : "h-2.5 w-2.5 rounded-[2px]"}
            style={{ background: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function ChartHeader({ title, sub, legend }: { title: string; sub?: ReactNode; legend?: LegendItem[] }) {
  return (
    <div className="mb-3 space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium" style={{ color: INK.primary }}>
          {title}
        </h3>
        {sub && <span className="micro normal-case tracking-wide">{sub}</span>}
      </div>
      {legend && legend.length > 1 && <Legend items={legend} />}
    </div>
  );
}
