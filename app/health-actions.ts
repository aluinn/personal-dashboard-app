"use server";

import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { setSetting } from "@/lib/db/opp";
import { addDays, wallToInstant } from "@/lib/time";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const mins = (f: FormData, k: string) => {
  const n = Number(f.get(k));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1000) : 0;
};
const refresh = () => revalidatePath("/", "layout");

export async function saveSleepTarget(hours: number) {
  if (!Number.isFinite(hours)) throw new Error("Bad target");
  await setSetting("sleepTargetHours", Math.max(4, Math.min(12, Math.round(hours * 4) / 4)));
  refresh();
}

/**
 * Log or correct a night by hand. Bedtime is the evening before the wake date unless it's earlier than
 * the wake time (e.g. 00:30 -> 07:30). Saved as source "manual", which outranks imported data for that
 * night; deleting it reverts to the import.
 */
export async function saveManualNight(f: FormData) {
  const date = String(f.get("night") ?? "");
  const bed = String(f.get("bed") ?? "");
  const wake = String(f.get("wake") ?? "");
  if (!DATE.test(date) || !TIME.test(bed) || !TIME.test(wake)) throw new Error("Enter a date, bedtime and wake time");
  const bedDate = bed > wake ? addDays(date, -1) : date;
  const startAt = wallToInstant(bedDate, bed);
  const endAt = wallToInstant(date, wake);
  const total = (endAt - startAt) / 60000;
  if (total < 30 || total > 16 * 60) throw new Error("That sleep length doesn't look right");

  const deep = mins(f, "deep");
  const rem = mins(f, "rem");
  const core = mins(f, "core");
  const awake = Math.min(mins(f, "awake"), total - 10);
  const asleep = total - awake;
  const tz = Math.round((new Date(endAt).getTime() - Date.parse(`${date}T${wake}:00Z`)) / -60000);
  await q.run(
    `INSERT INTO sleep_sessions (night_date,start_at,end_at,tz_offset_min,asleep_min,core_min,deep_min,rem_min,awake_min,unspec_min,in_bed_min,is_nap,source,dedupe_key,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,0,'manual',?,?)
       ON CONFLICT(dedupe_key) DO UPDATE SET start_at=excluded.start_at,end_at=excluded.end_at,tz_offset_min=excluded.tz_offset_min,asleep_min=excluded.asleep_min,
         core_min=excluded.core_min,deep_min=excluded.deep_min,rem_min=excluded.rem_min,awake_min=excluded.awake_min,unspec_min=excluded.unspec_min,in_bed_min=excluded.in_bed_min`,
    [date, startAt, endAt, tz, asleep, core, deep, rem, awake, Math.max(0, asleep - core - deep - rem), total, `manual|${date}|main|0`, Date.now()],
  );
  refresh();
}

export async function deleteManualNight(date: string) {
  if (!DATE.test(date)) throw new Error("Bad date");
  await q.run("DELETE FROM sleep_sessions WHERE dedupe_key = ?", [`manual|${date}|main|0`]);
  refresh();
}

export async function clearHealthData() {
  await q.batch(["sleep_sessions", "heart_rate_daily", "hrv_daily", "steps_daily", "workouts_imported"].map((t) => ({ sql: `DELETE FROM ${t}` })));
  refresh();
}
