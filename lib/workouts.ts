// Pure workout analytics (server + client). All the "am I improving?" maths lives here.
import { MUSCLES, STRENGTH_TYPES } from "./exercises";

export type WSet = { reps: number; weightKg: number; rpe: number | null };
export type WExercise = { id: number; name: string; muscle: string; notes: string; sets: WSet[] };
export type WSession = { id: number; date: string; type: string; durationMin: number | null; distanceKm: number | null; notes: string; exercises: WExercise[] };
export type WatchWorkout = { id: number; type: string; date: string; startAt: number; durationMin: number | null; distanceKm: number | null; activeKcal: number | null; avgHr: number | null };
export type LinkedSession = WSession & { watch: WatchWorkout | null };

const DAY = 86_400_000;
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const addDaysISO = (d: string, n: number) => new Date(ms(d) + n * DAY).toISOString().slice(0, 10);
/** Monday of the week containing d. */
export const weekStart = (d: string) => addDaysISO(d, -((new Date(ms(d)).getUTCDay() + 6) % 7));

/** Epley estimated one-rep max. A single is the weight itself. */
export const epley = (weightKg: number, reps: number) => (reps <= 1 ? weightKg : weightKg * (1 + reps / 30));
const MAX_E1RM_REPS = 12; // Epley drifts above ~12 reps, so higher-rep sets don't set e1RM records

export const sessionVolume = (s: { exercises: WExercise[] }) => s.exercises.reduce((a, e) => a + e.sets.reduce((b, x) => b + x.reps * x.weightKg, 0), 0);

export type Category = "strength" | "run" | "cycle" | "other";
export function categoryOf(type: string): Category {
  const t = type.toLowerCase();
  if (STRENGTH_TYPES.includes(t) || /strength|weight|resistance|functional|core training|crossfit|high intensity/.test(t)) return "strength";
  if (/\brun|jog/.test(t)) return "run";
  if (/cycl|bike|biking/.test(t)) return "cycle";
  return "other";
}

export const watchDate = (startAt: number, tzOffsetMin: number) => new Date(startAt + tzOffsetMin * 60_000).toISOString().slice(0, 10);

/**
 * Attach Apple Watch workouts to logged sessions on the same date when the kind of workout agrees
 * (strength with strength, run with run…). Each Watch workout links to at most one session. Watch
 * workouts with no logged counterpart come back as `unmatched` so they still count as training days.
 */
export function linkWatch(sessions: WSession[], watches: WatchWorkout[]): { linked: LinkedSession[]; unmatched: WatchWorkout[] } {
  const free = new Set(watches.map((w) => w.id));
  const byDate = new Map<string, WatchWorkout[]>();
  for (const w of watches) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);
  const linked = [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .map((s): LinkedSession => {
      const cands = (byDate.get(s.date) ?? []).filter((w) => free.has(w.id) && categoryOf(w.type) === categoryOf(s.type));
      cands.sort((a, b) => Math.abs((a.durationMin ?? 0) - (s.durationMin ?? 0)) - Math.abs((b.durationMin ?? 0) - (s.durationMin ?? 0)));
      const w = cands[0] ?? null;
      if (w) free.delete(w.id);
      return { ...s, watch: w };
    });
  return { linked, unmatched: watches.filter((w) => free.has(w.id)) };
}

// ---- progression ------------------------------------------------------
export type LiftPoint = { date: string; e1rm: number; weightKg: number; reps: number; isPR: boolean; sessionId: number };

/** Best estimated 1RM per session for one exercise; flags every point that beat all earlier ones. */
export function exerciseSeries(sessions: WSession[], name: string): LiftPoint[] {
  const key = name.trim().toLowerCase();
  const pts: LiftPoint[] = [];
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)) {
    let best: LiftPoint | null = null;
    for (const e of s.exercises) {
      if (e.name.trim().toLowerCase() !== key) continue;
      for (const x of e.sets) {
        if (x.reps < 1 || x.reps > MAX_E1RM_REPS || x.weightKg <= 0) continue;
        const v = epley(x.weightKg, x.reps);
        if (!best || v > best.e1rm) best = { date: s.date, e1rm: v, weightKg: x.weightKg, reps: x.reps, isPR: false, sessionId: s.id };
      }
    }
    if (best) pts.push(best);
  }
  let max = 0;
  pts.forEach((p, i) => {
    if (i > 0 && p.e1rm > max + 0.01) p.isPR = true; // the first session is the baseline, not a "record"
    max = Math.max(max, p.e1rm);
  });
  return pts;
}

export function exerciseNames(sessions: WSession[]) {
  const m = new Map<string, { name: string; sessions: number }>();
  for (const s of sessions)
    for (const n of new Set(s.exercises.map((e) => e.name.trim()))) {
      const k = n.toLowerCase();
      const cur = m.get(k);
      m.set(k, { name: cur?.name ?? n, sessions: (cur?.sessions ?? 0) + 1 });
    }
  return [...m.values()].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

/** PR events in the last `days` days across all lifts (most recent first). */
export function recentPRs(sessions: WSession[], endDate: string, days: number) {
  const cutoff = addDaysISO(endDate, -(days - 1));
  const out: { name: string; date: string; e1rm: number; prev: number }[] = [];
  for (const { name } of exerciseNames(sessions)) {
    const pts = exerciseSeries(sessions, name);
    pts.forEach((p, i) => {
      if (p.isPR && p.date >= cutoff && p.date <= endDate) out.push({ name, date: p.date, e1rm: p.e1rm, prev: Math.max(...pts.slice(0, i).map((x) => x.e1rm)) });
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

// ---- volume, consistency ----------------------------------------------
export type Day = { date: string; sessions: number; volumeKg: number; minutes: number };

/** One row per date with any training (logged sessions + unmatched Watch workouts). */
export function dayMap(linked: LinkedSession[], unmatched: WatchWorkout[]) {
  const m = new Map<string, Day>();
  const get = (d: string) => m.get(d) ?? (m.set(d, { date: d, sessions: 0, volumeKg: 0, minutes: 0 }), m.get(d)!);
  for (const s of linked) {
    const d = get(s.date);
    d.sessions++;
    d.volumeKg += sessionVolume(s);
    d.minutes += s.durationMin ?? s.watch?.durationMin ?? 0;
  }
  for (const w of unmatched) {
    const d = get(w.date);
    d.sessions++;
    d.minutes += w.durationMin ?? 0;
  }
  return m;
}

export function weeklyVolume(days: Map<string, Day>, endDate: string, weeks: number) {
  const first = addDaysISO(weekStart(endDate), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDaysISO(first, i * 7);
    let volumeKg = 0;
    let sessions = 0;
    for (let k = 0; k < 7; k++) {
      const d = days.get(addDaysISO(start, k));
      if (d) {
        volumeKg += d.volumeKg;
        sessions += d.sessions;
      }
    }
    return { weekStart: start, volumeKg, sessions };
  });
}

export type HeatCell = { date: string; level: 0 | 1 | 2 | 3 | 4; sessions: number; volumeKg: number; minutes: number; future: boolean };

/** GitHub-style grid: columns are weeks (Mon-Sun rows). Brighter = more training that day (sessions + volume). */
export function heatmap(days: Map<string, Day>, endDate: string, weeks: number): HeatCell[][] {
  const vols = [...days.values()].map((d) => d.volumeKg).filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p: number) => (vols.length ? vols[Math.min(vols.length - 1, Math.floor(p * vols.length))] : Infinity);
  const p50 = q(0.5);
  const p85 = q(0.85);
  const first = addDaysISO(weekStart(endDate), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, r) => {
      const date = addDaysISO(first, w * 7 + r);
      const d = days.get(date);
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (d) {
        let l = d.sessions >= 2 ? 3 : 1;
        if (d.volumeKg >= p50) l++;
        if (d.volumeKg >= p85) l++;
        level = Math.min(4, l) as 1 | 2 | 3 | 4;
      }
      return { date, level, sessions: d?.sessions ?? 0, volumeKg: d?.volumeKg ?? 0, minutes: d?.minutes ?? 0, future: date > endDate };
    }),
  );
}

/** Hard sets per muscle group over the last `days` days (for the balance radar). */
export function muscleSets(sessions: WSession[], endDate: string, days: number) {
  const cutoff = addDaysISO(endDate, -(days - 1));
  const out = Object.fromEntries(MUSCLES.map((m) => [m.key, 0])) as Record<string, number>;
  for (const s of sessions) {
    if (s.date < cutoff || s.date > endDate) continue;
    for (const e of s.exercises) if (e.muscle in out) out[e.muscle] += e.sets.filter((x) => x.reps > 0).length;
  }
  return out;
}

export function weeklyCounts(days: Map<string, Day>, endDate: string, weeks: number) {
  return weeklyVolume(days, endDate, weeks).map((w) => ({ weekStart: w.weekStart, count: w.sessions }));
}

/**
 * Week streak = consecutive weeks hitting the weekly target. The current (unfinished) week counts if
 * you've already hit it, but doesn't break the streak if you haven't yet.
 */
export function weekStreak(counts: { weekStart: string; count: number }[], target: number) {
  let longest = 0;
  let run = 0;
  for (const w of counts) {
    run = w.count >= target ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  for (let i = counts.length - 1; i >= 0; i--) {
    if (counts[i].count >= target) current++;
    else if (i === counts.length - 1) continue; // this week isn't over
    else break;
  }
  return { current, longest };
}

export const tonnes = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(kg >= 10000 ? 0 : 1)} t` : `${Math.round(kg)} kg`);
