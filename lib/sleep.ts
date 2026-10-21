// Pure sleep analytics (runs on server and client). Everything the Sleep page shows is computed here
// from the raw rows, so range changes are instant and the maths is in one testable place.

export type SleepRow = {
  id: number;
  nightDate: string;
  startAt: number | null;
  endAt: number | null;
  tzOffsetMin: number;
  asleepMin: number;
  coreMin: number;
  deepMin: number;
  remMin: number;
  awakeMin: number;
  unspecMin: number;
  inBedMin: number;
  isNap: boolean;
  source: string;
};
export type HrRow = { day: string; source: string; avg: number | null; min: number | null; max: number | null; resting: number | null };
export type HrvRow = { day: string; source: string; avg: number | null };

// When several imports cover the same night, the lowest rank wins (a manual fix beats everything).
const RANK: Record<string, number> = { manual: 0, apple: 1, hae: 2, api: 3 };
const rank = (s: string) => RANK[s] ?? 9;

export type Night = {
  date: string;
  asleepH: number;
  coreH: number;
  deepH: number;
  remH: number;
  awakeH: number;
  unspecH: number;
  inBedH: number;
  startAt: number | null;
  endAt: number | null;
  /** Minutes since midnight at sleep onset, +1440 when after midnight (so 23:30 = 1410, 00:30 = 1470). */
  bedMin: number | null;
  /** Minutes since midnight at waking. */
  wakeMin: number | null;
  source: string;
  hasStages: boolean;
};

const localMinutes = (ms: number, tz: number) => ((Math.floor(ms / 60000) + tz) % 1440 + 1440) % 1440;

export function buildNights(rows: SleepRow[]): Night[] {
  const byDate = new Map<string, SleepRow[]>();
  for (const r of rows) {
    if (r.isNap) continue;
    byDate.set(r.nightDate, [...(byDate.get(r.nightDate) ?? []), r]);
  }
  const out: Night[] = [];
  for (const [date, list] of byDate) {
    const best = Math.min(...list.map((r) => rank(r.source)));
    const use = list.filter((r) => rank(r.source) === best).sort((a, b) => (a.startAt ?? 0) - (b.startAt ?? 0));
    const sum = (k: keyof SleepRow) => use.reduce((a, r) => a + (r[k] as number), 0) / 60;
    const withTimes = use.filter((r) => r.startAt !== null && r.endAt !== null);
    const first = withTimes[0];
    const last = withTimes[withTimes.length - 1];
    const bed = first ? localMinutes(first.startAt!, first.tzOffsetMin) : null;
    const deepH = sum("deepMin");
    const remH = sum("remMin");
    const coreH = sum("coreMin");
    out.push({
      date,
      asleepH: sum("asleepMin"),
      coreH,
      deepH,
      remH,
      awakeH: sum("awakeMin"),
      unspecH: sum("unspecMin"),
      inBedH: sum("inBedMin"),
      startAt: first?.startAt ?? null,
      endAt: last?.endAt ?? null,
      bedMin: bed === null ? null : bed < 720 ? bed + 1440 : bed,
      wakeMin: last ? localMinutes(last.endAt!, last.tzOffsetMin) : null,
      source: use[0].source,
      hasStages: deepH + remH + coreH > 0,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const DAY = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const addDaysISO = (d: string, n: number) => new Date(toMs(d) + n * DAY).toISOString().slice(0, 10);

/** Calendar days ending at `end`, `count` long (null = every day from the first night). */
export function dayRange(end: string, count: number | null, first: string) {
  const n = count ?? Math.max(1, Math.round((toMs(end) - toMs(first)) / DAY) + 1);
  return Array.from({ length: n }, (_, i) => addDaysISO(end, i - (n - 1)));
}

/** Trailing moving average over calendar days; gaps are skipped, not treated as zero. */
export function movingAverage(vals: (number | null)[], window: number): (number | null)[] {
  return vals.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - window + 1); j <= i; j++) {
      const v = vals[j];
      if (v !== null) {
        s += v;
        n++;
      }
    }
    return n ? s / n : null;
  });
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

/**
 * 0-100 sleep score for one night. Components (weights): duration vs target 50, restorative
 * share (deep+REM of sleep, full marks at 40%) 25, efficiency (asleep / (asleep+awake), full at 90%) 15,
 * bedtime regularity vs your recent median (full within 15 min, zero at 90 min off) 10.
 * Components with no data are left out and the rest re-weighted, so a totals-only import isn't punished.
 */
export function nightScore(n: Night, target: number, recentBedMins: number[]) {
  const parts: { w: number; v: number }[] = [{ w: 50, v: Math.min(1, n.asleepH / Math.max(1, target)) }];
  if (n.hasStages && n.asleepH > 0) parts.push({ w: 25, v: Math.min(1, (n.deepH + n.remH) / n.asleepH / 0.4) });
  if (n.asleepH > 0 && (n.awakeH > 0 || n.inBedH > n.asleepH)) {
    const eff = n.awakeH > 0 ? n.asleepH / (n.asleepH + n.awakeH) : n.asleepH / n.inBedH;
    parts.push({ w: 15, v: Math.min(1, Math.max(0, eff / 0.9)) });
  }
  if (n.bedMin !== null && recentBedMins.length >= 3) {
    const dev = Math.abs(n.bedMin - median(recentBedMins));
    parts.push({ w: 10, v: Math.max(0, Math.min(1, 1 - (dev - 15) / 75)) });
  }
  const W = parts.reduce((a, p) => a + p.w, 0);
  return Math.round((100 * parts.reduce((a, p) => a + p.w * p.v, 0)) / W);
}

export function scoresFor(nights: Night[], target: number) {
  const map = new Map<string, number>();
  nights.forEach((n, i) => {
    const prev = nights.slice(Math.max(0, i - 14), i).map((x) => x.bedMin).filter((x): x is number => x !== null);
    map.set(n.date, nightScore(n, target, prev));
  });
  return map;
}

export type SleepStats = {
  count: number;
  avgH: number | null;
  debtH: number; // last 7 recorded nights vs target, floored at 0
  consistency: number | null; // 0-100
  bedSd: number | null;
  wakeSd: number | null;
  best: Night | null;
  worst: Night | null;
  streak: number; // current run of nights >= threshold
  longest: number;
  threshold: number;
  avgScore: number | null;
};

export function computeStats(inRange: Night[], allDates: string[], target: number, scores: Map<string, number>): SleepStats {
  const threshold = Math.max(1, target - 1);
  const count = inRange.length;
  const avgH = count ? mean(inRange.map((n) => n.asleepH)) : null;
  const last7 = inRange.slice(-7);
  const debtH = Math.max(0, last7.reduce((a, n) => a + (target - n.asleepH), 0));
  const beds = inRange.map((n) => n.bedMin).filter((x): x is number => x !== null);
  const wakes = inRange.map((n) => n.wakeMin).filter((x): x is number => x !== null);
  const bedSd = beds.length >= 3 ? sd(beds) : null;
  const wakeSd = wakes.length >= 3 ? sd(wakes) : null;
  const consistency = bedSd !== null && wakeSd !== null ? Math.round(100 * Math.max(0, 1 - (bedSd + wakeSd) / 2 / 120)) : null;
  const sorted = [...inRange].sort((a, b) => a.asleepH - b.asleepH);

  // streaks run over consecutive calendar days; a missing night breaks the run
  const ok = new Set(inRange.filter((n) => n.asleepH >= threshold).map((n) => n.date));
  let run = 0;
  let longest = 0;
  for (const d of allDates) {
    run = ok.has(d) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const sc = inRange.map((n) => scores.get(n.date)).filter((x): x is number => x !== undefined);
  return {
    count, avgH, debtH, consistency, bedSd, wakeSd,
    best: sorted[sorted.length - 1] ?? null,
    worst: sorted[0] ?? null,
    streak: run, longest, threshold,
    avgScore: sc.length ? Math.round(mean(sc)) : null,
  };
}

/**
 * Height field for the 3D terrain. Row 0 (front) is each actual night; each row behind it averages a
 * wider neighbourhood (radius = row), so the range gets smoother toward the horizon like layered hills.
 */
export function terrainGrid(vals: (number | null)[], rows: number): number[][] {
  return Array.from({ length: rows }, (_, r) =>
    vals.map((_, i) => {
      if (r === 0) return vals[i] ?? 0;
      let s = 0;
      let n = 0;
      for (let j = Math.max(0, i - r); j <= Math.min(vals.length - 1, i + r); j++) {
        const v = vals[j];
        if (v !== null) {
        s += v;
        n++;
      }
      }
      return n ? s / n : 0;
    }),
  );
}

export const fmtHM = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;
export const fmtClock = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Pick one row per day, preferring the best-ranked source. */
export function pickByDay<T extends { day: string; source: string }>(rows: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) {
    const cur = m.get(r.day);
    if (!cur || rank(r.source) < rank(cur.source)) m.set(r.day, r);
  }
  return m;
}
