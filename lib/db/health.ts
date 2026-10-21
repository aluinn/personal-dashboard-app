import "server-only";
import { connection } from "next/server";
import { asc } from "drizzle-orm";
import { db, schema } from "./index";
import { getSetting } from "./opp";
import type { HrRow, HrvRow, SleepRow } from "@/lib/sleep";

export const getSleepTarget = () => getSetting<number>("sleepTargetHours", 8);

export function loadSleepRows(): SleepRow[] {
  return db
    .select()
    .from(schema.sleepSessions)
    .orderBy(asc(schema.sleepSessions.nightDate))
    .all()
    .map((r) => ({
      id: r.id, nightDate: r.nightDate, startAt: r.startAt, endAt: r.endAt, tzOffsetMin: r.tzOffsetMin,
      asleepMin: r.asleepMin, coreMin: r.coreMin, deepMin: r.deepMin, remMin: r.remMin, awakeMin: r.awakeMin,
      unspecMin: r.unspecMin, inBedMin: r.inBedMin, isNap: r.isNap === 1, source: r.source,
    }));
}

export async function getSleepPageData() {
  await connection();
  const hr: HrRow[] = db.select().from(schema.heartRateDaily).all().map((r) => ({ day: r.day, source: r.source, avg: r.avg, min: r.min, max: r.max, resting: r.resting }));
  const hrv: HrvRow[] = db.select().from(schema.hrvDaily).all().map((r) => ({ day: r.day, source: r.source, avg: r.avg }));
  return { rows: loadSleepRows(), hr, hrv, target: getSleepTarget() };
}
