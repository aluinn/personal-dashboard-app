import "server-only";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import { parseHealthDate } from "./dates";
import { buildSessions, type Segment, type SegKind } from "./sleep-sessions";
import { emptyBatch, type HealthBatch } from "./types";

// Streams Apple Health's export.xml line by line (files can be GB-sized, so nothing is loaded whole).
// Apple writes each <Record .../> / <Workout ...> opening tag on one line, so we read attributes from
// that line and ignore children, except WorkoutStatistics which carry workout energy/distance/HR.

const SLEEP_VALUES: Record<string, SegKind> = {
  HKCategoryValueSleepAnalysisInBed: "inbed",
  HKCategoryValueSleepAnalysisAsleep: "unspec",
  HKCategoryValueSleepAnalysisAsleepUnspecified: "unspec",
  HKCategoryValueSleepAnalysisAsleepCore: "core",
  HKCategoryValueSleepAnalysisAsleepDeep: "deep",
  HKCategoryValueSleepAnalysisAsleepREM: "rem",
  HKCategoryValueSleepAnalysisAwake: "awake",
};

const ATTR = /(\w+)="([^"]*)"/g;
const attrs = (line: string) => {
  const o: Record<string, string> = {};
  for (const m of line.matchAll(ATTR)) o[m[1]] = m[2];
  return o;
};

const T = {
  sleep: "HKCategoryTypeIdentifierSleepAnalysis",
  hr: "HKQuantityTypeIdentifierHeartRate",
  rhr: "HKQuantityTypeIdentifierRestingHeartRate",
  hrv: "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
  steps: "HKQuantityTypeIdentifierStepCount",
  energy: "HKQuantityTypeIdentifierActiveEnergyBurned",
};

type Acc = { sum: number; n: number; min: number; max: number };
const accAdd = (m: Map<string, Acc>, day: string, v: number) => {
  const a = m.get(day);
  if (a) {
    a.sum += v;
    a.n++;
    if (v < a.min) a.min = v;
    if (v > a.max) a.max = v;
  } else m.set(day, { sum: v, n: 1, min: v, max: v });
};

const toKcal = (v: number, unit?: string) => (unit && /kj/i.test(unit) ? v / 4.184 : v);
const toKm = (v: number, unit?: string) => (unit && /^mi/i.test(unit) ? v * 1.609344 : unit && /^m$/i.test(unit) ? v / 1000 : v);
const niceType = (t: string) => t.replace("HKWorkoutActivityType", "").replace(/([a-z])([A-Z])/g, "$1 $2");

export async function parseAppleXml(
  input: Readable,
  onProgress?: (records: number) => void,
): Promise<{ batch: HealthBatch; counts: Record<string, number> }> {
  const batch = emptyBatch();
  const segments: Segment[] = [];
  const hr = new Map<string, Acc>();
  const rhr = new Map<string, Acc>();
  const hrv = new Map<string, Acc>();
  // steps & energy: per day per source, then take the busiest source (iPhone + Watch both log steps)
  const steps = new Map<string, Map<string, number>>();
  const energy = new Map<string, Map<string, number>>();
  const add2 = (m: Map<string, Map<string, number>>, day: string, src: string, v: number) => {
    let d = m.get(day);
    if (!d) m.set(day, (d = new Map()));
    d.set(src, (d.get(src) ?? 0) + v);
  };
  const counts = { sleepSegments: 0, heartRate: 0, restingHr: 0, hrv: 0, steps: 0, energy: 0, workouts: 0 };

  let wk: { a: Record<string, string>; kcal?: number; km?: number; hr?: number } | null = null;
  const closeWorkout = () => {
    if (!wk) return;
    const s = parseHealthDate(wk.a.startDate ?? "");
    const e = parseHealthDate(wk.a.endDate ?? "");
    if (s && e) {
      const durUnit = wk.a.durationUnit ?? "min";
      const dur = Number(wk.a.duration);
      const durationMin = Number.isFinite(dur) ? (durUnit === "s" ? dur / 60 : durUnit === "hr" ? dur * 60 : dur) : (e.ms - s.ms) / 60000;
      const dist = wk.km ?? (wk.a.totalDistance ? toKm(Number(wk.a.totalDistance), wk.a.totalDistanceUnit) : null);
      const kcal = wk.kcal ?? (wk.a.totalEnergyBurned ? toKcal(Number(wk.a.totalEnergyBurned), wk.a.totalEnergyBurnedUnit) : null);
      batch.workouts.push({
        type: niceType(wk.a.workoutActivityType ?? "Workout"),
        startAt: s.ms,
        endAt: e.ms,
        tzOffsetMin: s.tzOffsetMin,
        durationMin,
        distanceKm: dist && Number.isFinite(dist) ? dist : null,
        activeKcal: kcal && Number.isFinite(kcal) ? kcal : null,
        avgHr: wk.hr ?? null,
      });
      counts.workouts++;
    }
    wk = null;
  };

  let lines = 0;
  const rl = createInterface({ input, crlfDelay: Infinity });
  for await (const line of rl) {
    if (++lines % 200_000 === 0) onProgress?.(lines);

    if (wk) {
      if (line.includes("<WorkoutStatistics")) {
        const a = attrs(line);
        if (a.type === T.energy && a.sum) wk.kcal = toKcal(Number(a.sum), a.unit);
        else if (a.type === T.hr && a.average) wk.hr = Number(a.average);
        else if (/DistanceWalkingRunning|DistanceCycling|DistanceSwimming|DistanceDownhill/.test(a.type ?? "") && a.sum) wk.km = (wk.km ?? 0) + toKm(Number(a.sum), a.unit);
      }
      if (line.includes("</Workout>")) closeWorkout();
      else if (line.includes("<Workout ") && line.trimEnd().endsWith("/>")) closeWorkout();
      continue;
    }
    if (line.includes("<Workout ")) {
      wk = { a: attrs(line) };
      if (line.trimEnd().endsWith("/>")) closeWorkout();
      continue;
    }
    if (!line.includes("<Record ")) continue;

    // cheap substring test before the attribute regex: most records are types we don't need
    const isSleep = line.includes(T.sleep);
    const isHr = !isSleep && line.includes(`"${T.hr}"`);
    const isRhr = !isSleep && !isHr && line.includes(T.rhr);
    const isHrv = !isSleep && !isHr && !isRhr && line.includes(T.hrv);
    const isSteps = line.includes(T.steps);
    const isEnergy = line.includes(T.energy);
    if (!(isSleep || isHr || isRhr || isHrv || isSteps || isEnergy)) continue;

    const a = attrs(line);
    const s = parseHealthDate(a.startDate ?? "");
    if (!s) continue;
    if (isSleep) {
      const e = parseHealthDate(a.endDate ?? "");
      const kind = SLEEP_VALUES[a.value ?? ""];
      if (e && kind) {
        segments.push({ startMs: s.ms, endMs: e.ms, kind, tzOffsetMin: s.tzOffsetMin });
        counts.sleepSegments++;
      }
      continue;
    }
    const v = Number(a.value);
    if (!Number.isFinite(v)) continue;
    if (isHr) {
      accAdd(hr, s.day, v);
      counts.heartRate++;
    } else if (isRhr) {
      accAdd(rhr, s.day, v);
      counts.restingHr++;
    } else if (isHrv) {
      accAdd(hrv, s.day, v);
      counts.hrv++;
    } else if (isSteps) {
      add2(steps, s.day, a.sourceName ?? "?", v);
      counts.steps++;
    } else if (isEnergy) {
      add2(energy, s.day, a.sourceName ?? "?", toKcal(v, a.unit));
      counts.energy++;
    }
  }

  batch.sleep = buildSessions(segments);
  const days = new Set([...hr.keys(), ...rhr.keys()]);
  for (const day of days) {
    const h = hr.get(day);
    const r = rhr.get(day);
    batch.hr.push({ day, avg: h ? h.sum / h.n : null, min: h?.min ?? null, max: h?.max ?? null, resting: r ? r.sum / r.n : null, samples: h?.n ?? null });
  }
  for (const [day, a] of hrv) batch.hrv.push({ day, avg: a.sum / a.n, min: a.min, max: a.max, samples: a.n });
  const best = (m: Map<string, number> | undefined) => (m ? Math.max(...m.values()) : null);
  for (const day of new Set([...steps.keys(), ...energy.keys()])) {
    batch.steps.push({ day, steps: best(steps.get(day)), activeKcal: best(energy.get(day)) });
  }
  return { batch, counts: { ...counts, nights: batch.sleep.length } };
}
