// Mappers for Health Auto Export (https://www.healthyapps.dev) JSON and generic CSV, plus a small
// "native" JSON shape that's easy to build in an iOS Shortcut. Pure functions (testable).
// Field names for the JSON come from Health Auto Export's own export-format docs
// (sleep_analysis aggregated: date/totalSleep/asleep/core/deep/rem/sleepStart/sleepEnd/inBed;
// heart_rate: Min/Avg/Max; workouts V2: name/start/end/duration(s)/distance{qty,units}/activeEnergyBurned{qty,units}).
// Unknown/missing fields are tolerated: anything we can't read is skipped, never guessed.
import { parseHealthDate } from "./dates";
import { buildSessions, type Segment, type SegKind } from "./sleep-sessions";
import { emptyBatch, type HealthBatch } from "./types";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "object" ? Number((v as { qty?: unknown }).qty) : Number(v);
  return Number.isFinite(n) ? n : null;
};
const hoursToMin = (v: unknown) => {
  const n = num(v);
  return n === null ? null : n * 60;
};
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const MAX_ITEMS = 50_000;

const toKcal = (q: number | null, units?: unknown) => (q === null ? null : /kj/i.test(String(units ?? "")) ? q / 4.184 : q);
const toKm = (q: number | null, units?: unknown) => {
  if (q === null) return null;
  const u = String(units ?? "km").toLowerCase();
  return u.startsWith("mi") ? q * 1.609344 : u === "m" ? q / 1000 : q;
};

const SEG_KIND: Record<string, SegKind> = { awake: "awake", asleep: "unspec", unspecified: "unspec", "in bed": "inbed", inbed: "inbed", core: "core", rem: "rem", deep: "deep" };

export function mapHaeJson(payload: unknown): HealthBatch {
  const b = emptyBatch();
  const data = obj(obj(payload).data ?? payload);
  const metrics = Array.isArray(data.metrics) ? data.metrics.slice(0, 200) : [];

  const hrAcc = new Map<string, { sum: number; n: number; min: number; max: number }>();
  const segs: Segment[] = [];

  for (const m of metrics) {
    const name = String(obj(m).name ?? "").toLowerCase();
    const points = (Array.isArray(obj(m).data) ? (obj(m).data as unknown[]) : []).slice(0, MAX_ITEMS);
    const units = obj(m).units;

    if (name === "sleep_analysis") {
      for (const p of points) {
        const o = obj(p);
        if (typeof o.value === "string" && o.startDate && o.endDate) {
          // un-aggregated: one record per stage segment
          const s = parseHealthDate(String(o.startDate));
          const e = parseHealthDate(String(o.endDate));
          const kind = SEG_KIND[o.value.toLowerCase()];
          if (s && e && kind) segs.push({ startMs: s.ms, endMs: e.ms, kind, tzOffsetMin: s.tzOffsetMin });
          continue;
        }
        const dateStr = String(o.date ?? o.sleepEnd ?? "");
        const day = parseHealthDate(dateStr)?.day;
        if (!day) continue;
        const start = o.sleepStart ? parseHealthDate(String(o.sleepStart)) : null;
        const end = o.sleepEnd ? parseHealthDate(String(o.sleepEnd)) : null;
        const core = hoursToMin(o.core) ?? 0;
        const deep = hoursToMin(o.deep) ?? 0;
        const rem = hoursToMin(o.rem) ?? 0;
        const asleep = hoursToMin(o.asleep) ?? hoursToMin(o.totalSleep) ?? core + deep + rem;
        if (asleep < 20) continue;
        b.sleep.push({
          nightDate: day,
          startAt: start?.ms ?? null,
          endAt: end?.ms ?? null,
          tzOffsetMin: (end ?? start)?.tzOffsetMin ?? 0,
          asleepMin: asleep,
          coreMin: core,
          deepMin: deep,
          remMin: rem,
          awakeMin: hoursToMin(o.awake) ?? 0,
          unspecMin: Math.max(0, asleep - core - deep - rem),
          inBedMin: hoursToMin(o.inBed) ?? asleep,
          isNap: false,
          index: 0,
        });
      }
    } else if (name === "heart_rate") {
      for (const p of points) {
        const o = obj(p);
        const day = parseHealthDate(String(o.date ?? ""))?.day;
        const avg = num(o.Avg ?? o.avg ?? o.qty);
        if (!day || avg === null) continue;
        const mn = num(o.Min ?? o.min) ?? avg;
        const mx = num(o.Max ?? o.max) ?? avg;
        const a = hrAcc.get(day);
        if (a) {
          a.sum += avg;
          a.n++;
          a.min = Math.min(a.min, mn);
          a.max = Math.max(a.max, mx);
        } else hrAcc.set(day, { sum: avg, n: 1, min: mn, max: mx });
      }
    } else if (name === "resting_heart_rate") {
      for (const p of points) {
        const o = obj(p);
        const day = parseHealthDate(String(o.date ?? ""))?.day;
        const v = num(o.qty ?? o.Avg ?? o.avg);
        if (day && v !== null) b.hr.push({ day, resting: v });
      }
    } else if (name === "heart_rate_variability" || name === "heart_rate_variability_sdnn") {
      for (const p of points) {
        const o = obj(p);
        const day = parseHealthDate(String(o.date ?? ""))?.day;
        const v = num(o.qty ?? o.Avg ?? o.avg);
        if (day && v !== null) b.hrv.push({ day, avg: v, min: num(o.Min ?? o.min), max: num(o.Max ?? o.max) });
      }
    } else if (name === "step_count" || name === "active_energy" || name === "active_energy_burned") {
      const byDay = new Map<string, number>();
      for (const p of points) {
        const o = obj(p);
        const day = parseHealthDate(String(o.date ?? ""))?.day;
        let v = num(o.qty);
        if (name !== "step_count") v = toKcal(v, units);
        if (day && v !== null) byDay.set(day, (byDay.get(day) ?? 0) + v);
      }
      for (const [day, v] of byDay) b.steps.push(name === "step_count" ? { day, steps: v } : { day, activeKcal: v });
    }
  }
  for (const [day, a] of hrAcc) b.hr.push({ day, avg: a.sum / a.n, min: a.min, max: a.max, samples: a.n });
  if (segs.length) b.sleep.push(...buildSessions(segs));

  const workouts = (Array.isArray(data.workouts) ? data.workouts : []).slice(0, MAX_ITEMS);
  for (const w of workouts) {
    const o = obj(w);
    const s = parseHealthDate(String(o.start ?? ""));
    const e = parseHealthDate(String(o.end ?? ""));
    if (!s || !e) continue;
    const dur = num(o.duration);
    const dist = obj(o.distance);
    const en = obj(o.activeEnergyBurned ?? o.activeEnergy);
    b.workouts.push({
      type: String(o.name ?? "Workout"),
      startAt: s.ms,
      endAt: e.ms,
      tzOffsetMin: s.tzOffsetMin,
      durationMin: dur === null ? (e.ms - s.ms) / 60000 : dur / 60, // Health Auto Export V2: seconds
      distanceKm: toKm(num(dist.qty), dist.units),
      activeKcal: toKcal(num(en.qty), en.units),
      avgHr: num(obj(obj(o.heartRate).avg).qty ?? o.avgHeartRate),
    });
  }
  return b;
}

/** Simple shape for Shortcuts / scripts: see the Settings page for an example. */
export function mapNativeJson(p: unknown): HealthBatch {
  const o = obj(p);
  const b = emptyBatch();
  const arr = (k: string) => (Array.isArray(o[k]) ? (o[k] as unknown[]).slice(0, MAX_ITEMS) : []);
  for (const x of arr("sleep")) {
    const r = obj(x);
    const start = r.start ? parseHealthDate(String(r.start)) : null;
    const end = r.end ? parseHealthDate(String(r.end)) : null;
    const night = String(r.night ?? (end ? end.day : ""));
    const core = hoursToMin(r.coreHours) ?? 0;
    const deep = hoursToMin(r.deepHours) ?? 0;
    const rem = hoursToMin(r.remHours) ?? 0;
    const asleep = hoursToMin(r.asleepHours) ?? core + deep + rem;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night) || asleep < 20) continue;
    b.sleep.push({
      nightDate: night, startAt: start?.ms ?? null, endAt: end?.ms ?? null, tzOffsetMin: (end ?? start)?.tzOffsetMin ?? 0,
      asleepMin: asleep, coreMin: core, deepMin: deep, remMin: rem, awakeMin: hoursToMin(r.awakeHours) ?? 0,
      unspecMin: Math.max(0, asleep - core - deep - rem), inBedMin: hoursToMin(r.inBedHours) ?? asleep, isNap: false, index: 0,
    });
  }
  const day = (r: Record<string, unknown>) => (/^\d{4}-\d{2}-\d{2}$/.test(String(r.day)) ? String(r.day) : null);
  for (const x of arr("heartRate")) { const r = obj(x); const d = day(r); if (d) b.hr.push({ day: d, avg: num(r.avg), min: num(r.min), max: num(r.max), resting: num(r.resting) }); }
  for (const x of arr("hrv")) { const r = obj(x); const d = day(r); if (d) b.hrv.push({ day: d, avg: num(r.avg), min: num(r.min), max: num(r.max) }); }
  for (const x of arr("steps")) { const r = obj(x); const d = day(r); if (d) b.steps.push({ day: d, steps: num(r.steps), activeKcal: num(r.activeKcal) }); }
  for (const x of arr("workouts")) {
    const r = obj(x);
    const s = parseHealthDate(String(r.start ?? ""));
    const e = parseHealthDate(String(r.end ?? ""));
    if (!s || !e) continue;
    b.workouts.push({ type: String(r.type ?? "Workout"), startAt: s.ms, endAt: e.ms, tzOffsetMin: s.tzOffsetMin, durationMin: num(r.durationMin) ?? (e.ms - s.ms) / 60000, distanceKm: num(r.distanceKm), activeKcal: num(r.activeKcal), avgHr: num(r.avgHr) });
  }
  return b;
}

export const looksLikeHae = (p: unknown) => Array.isArray(obj(obj(p).data ?? p).metrics) || Array.isArray(obj(obj(p).data ?? p).workouts);
