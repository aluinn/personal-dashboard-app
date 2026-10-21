import { addDaysISO, nightScore, pickByDay, type HrvRow, type Night } from "@/lib/sleep";
import type { Day } from "@/lib/workouts";

// Readiness (0-100) = weighted blend of three things, each scored 0-100:
//   sleep  50%  last night's sleep score (same score as the Sleep page)
//   HRV    30%  latest HRV vs your own 28-day average
//   load   20%  last 7 days of training vs your 28-day weekly average
// A part with no data is left out and the others re-weighted; with no data at all there is no score.
// It's a simple heuristic for orientation, not a medical measure.

export type Part = { key: "sleep" | "hrv" | "load"; label: string; value: number; weight: number; detail: string };
export type Readiness = { score: number | null; parts: Part[]; missing: string[] };

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

/** Piecewise-linear interpolation through [x, y] points (x ascending). */
function curve(x: number, pts: [number, number][]) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

export const HRV_CURVE: [number, number][] = [[0.7, 10], [0.8, 35], [0.9, 60], [1.0, 85], [1.05, 100]];
export const LOAD_CURVE: [number, number][] = [[0, 85], [0.8, 90], [1.3, 95], [1.5, 65], [2.0, 30]];

export function computeReadiness(
  asOf: string,
  nights: Night[],
  target: number,
  hrv: HrvRow[],
  days: Map<string, Day>,
): Readiness {
  const parts: Part[] = [];
  const missing: string[] = [];

  // Sleep: the latest night on or before asOf, only if it's from last night or this morning.
  const upTo = nights.filter((n) => n.date <= asOf);
  const last = upTo[upTo.length - 1];
  if (last && last.date >= addDaysISO(asOf, -1)) {
    const recent = upTo.slice(-15, -1).map((n) => n.bedMin).filter((x): x is number => x !== null);
    const v = nightScore(last, target, recent);
    parts.push({ key: "sleep", label: "Sleep", value: v, weight: 50, detail: `${last.asleepH.toFixed(1)}h, score ${v}` });
  } else missing.push("sleep");

  // HRV vs your own baseline (previous 28 days, at least 7 readings).
  const byDay = pickByDay(hrv.filter((r) => r.avg !== null));
  const dates = [...byDay.keys()].filter((d) => d <= asOf).sort();
  const latestDay = dates[dates.length - 1];
  if (latestDay && latestDay >= addDaysISO(asOf, -1)) {
    const base = dates.filter((d) => d < latestDay && d >= addDaysISO(latestDay, -28)).map((d) => byDay.get(d)!.avg as number);
    if (base.length >= 7) {
      const cur = byDay.get(latestDay)!.avg as number;
      const r = cur / mean(base);
      parts.push({ key: "hrv", label: "HRV", value: Math.round(curve(r, HRV_CURVE)), weight: 30, detail: `${Math.round(cur)} ms vs ${Math.round(mean(base))} ms baseline` });
    } else missing.push("hrv");
  } else missing.push("hrv");

  // Training load: minutes (or ~45 per session when duration is unknown) over the last 7 days
  // against your average week over the previous 28. Spikes lower readiness; resting doesn't.
  const load = (d: Day | undefined) => (d ? d.minutes || d.sessions * 45 : 0);
  const sum = (from: number, to: number) => {
    let t = 0;
    for (let i = from; i <= to; i++) t += load(days.get(addDaysISO(asOf, -i)));
    return t;
  };
  const everTrained = [...days.keys()].some((d) => d <= asOf);
  if (everTrained) {
    const acute = sum(0, 6);
    const chronicWeek = sum(0, 27) / 4;
    let ratio = chronicWeek > 0 ? acute / chronicWeek : 1;
    if (chronicWeek === 0) ratio = 1;
    let v = curve(ratio, LOAD_CURVE);
    const streak3 = [0, 1, 2].every((i) => load(days.get(addDaysISO(asOf, -i))) > 0);
    if (streak3) v -= 10;
    parts.push({
      key: "load",
      label: "Training load",
      value: Math.round(clamp(v)),
      weight: 20,
      detail: `${Math.round(acute)} min this week vs ${Math.round(chronicWeek)} avg${streak3 ? ", 3 days in a row" : ""}`,
    });
  } else missing.push("load");

  if (parts.length === 0) return { score: null, parts, missing };
  const W = parts.reduce((a, p) => a + p.weight, 0);
  return { score: Math.round(parts.reduce((a, p) => a + p.weight * p.value, 0) / W), parts, missing };
}
