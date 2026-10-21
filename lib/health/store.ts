import "server-only";
import { q } from "@/lib/db";
import type { HealthBatch, Source, SleepNight } from "./types";

const keyOf = (source: string, s: SleepNight) => `${source}|${s.nightDate}|${s.isNap ? "nap" : "main"}|${s.index}`;

/** Write a batch. Everything is an upsert, so importing the same data twice changes nothing. */
const SLEEP = `
    INSERT INTO sleep_sessions (night_date,start_at,end_at,tz_offset_min,asleep_min,core_min,deep_min,rem_min,awake_min,unspec_min,in_bed_min,is_nap,source,dedupe_key,created_at)
    VALUES (@night,@start,@end,@tz,@asleep,@core,@deep,@rem,@awake,@unspec,@inbed,@nap,@source,@key,@now)
    ON CONFLICT(dedupe_key) DO UPDATE SET night_date=excluded.night_date,start_at=excluded.start_at,end_at=excluded.end_at,
      tz_offset_min=excluded.tz_offset_min,asleep_min=excluded.asleep_min,core_min=excluded.core_min,deep_min=excluded.deep_min,
      rem_min=excluded.rem_min,awake_min=excluded.awake_min,unspec_min=excluded.unspec_min,in_bed_min=excluded.in_bed_min,is_nap=excluded.is_nap`;
const HR = `
    INSERT INTO heart_rate_daily (day,source,avg,min,max,resting,samples) VALUES (@day,@source,@avg,@min,@max,@resting,@samples)
    ON CONFLICT(day,source) DO UPDATE SET avg=COALESCE(excluded.avg,avg),min=COALESCE(excluded.min,min),max=COALESCE(excluded.max,max),
      resting=COALESCE(excluded.resting,resting),samples=COALESCE(excluded.samples,samples)`;
const HRV = `
    INSERT INTO hrv_daily (day,source,avg,min,max,samples) VALUES (@day,@source,@avg,@min,@max,@samples)
    ON CONFLICT(day,source) DO UPDATE SET avg=COALESCE(excluded.avg,avg),min=COALESCE(excluded.min,min),max=COALESCE(excluded.max,max),samples=COALESCE(excluded.samples,samples)`;
const STEPS = `
    INSERT INTO steps_daily (day,source,steps,active_kcal) VALUES (@day,@source,@steps,@kcal)
    ON CONFLICT(day,source) DO UPDATE SET steps=COALESCE(excluded.steps,steps),active_kcal=COALESCE(excluded.active_kcal,active_kcal)`;
const WK = `
    INSERT INTO workouts_imported (type,start_at,end_at,tz_offset_min,duration_min,distance_km,active_kcal,avg_hr,source,dedupe_key)
    VALUES (@type,@start,@end,@tz,@dur,@dist,@kcal,@hr,@source,@key)
    ON CONFLICT(dedupe_key) DO UPDATE SET duration_min=excluded.duration_min,distance_km=excluded.distance_km,active_kcal=excluded.active_kcal,avg_hr=COALESCE(excluded.avg_hr,avg_hr)`;

const CHUNK = 400; // statements per round trip (each chunk is atomic; every statement is an idempotent upsert)

/** Write a batch. Everything is an upsert, so importing the same data twice changes nothing. */
export async function applyBatch(batch: HealthBatch, source: Source) {
  const now = Date.now();
  const res = { sleep: 0, hr: 0, hrv: 0, steps: 0, workouts: 0 };
  const n = (v: number | null | undefined) => (v === undefined || v === null || !Number.isFinite(v) ? null : v);
  type Args = Record<string, string | number | null>;
  const stmts: { sql: string; args: Args }[] = [];
  for (const s of batch.sleep) {
    stmts.push({ sql: SLEEP, args: { night: s.nightDate, start: s.startAt, end: s.endAt, tz: s.tzOffsetMin, asleep: s.asleepMin, core: s.coreMin, deep: s.deepMin, rem: s.remMin, awake: s.awakeMin, unspec: s.unspecMin, inbed: s.inBedMin, nap: s.isNap ? 1 : 0, source, key: keyOf(source, s), now } });
    res.sleep++;
  }
  for (const r of batch.hr) {
    stmts.push({ sql: HR, args: { day: r.day, source, avg: n(r.avg), min: n(r.min), max: n(r.max), resting: n(r.resting), samples: n(r.samples) } });
    res.hr++;
  }
  for (const r of batch.hrv) {
    stmts.push({ sql: HRV, args: { day: r.day, source, avg: n(r.avg), min: n(r.min), max: n(r.max), samples: n(r.samples) } });
    res.hrv++;
  }
  for (const r of batch.steps) {
    stmts.push({ sql: STEPS, args: { day: r.day, source, steps: n(r.steps), kcal: n(r.activeKcal) } });
    res.steps++;
  }
  for (const w of batch.workouts) {
    stmts.push({ sql: WK, args: { type: w.type, start: w.startAt, end: w.endAt, tz: w.tzOffsetMin, dur: n(w.durationMin), dist: n(w.distanceKm), kcal: n(w.activeKcal), hr: n(w.avgHr), source, key: `${w.type}|${w.startAt}|${w.endAt}` } });
    res.workouts++;
  }
  for (let i = 0; i < stmts.length; i += CHUNK) await q.batch(stmts.slice(i, i + CHUNK));
  return res;
}
