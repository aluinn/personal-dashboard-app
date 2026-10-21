import "server-only";
import { connection } from "next/server";
import { asc } from "drizzle-orm";
import { db, schema } from "./index";
import { getSetting } from "./opp";
import type { HrRow, HrvRow, SleepRow } from "@/lib/sleep";

export const getSleepTarget = () => getSetting<number>("sleepTargetHours", 8);

export async function loadSleepRows(): Promise<SleepRow[]> {
  return (
    await db
      .select()
      .from(schema.sleepSessions)
      .orderBy(asc(schema.sleepSessions.nightDate))
      .all()
  ).map((r) => ({
      id: r.id, nightDate: r.nightDate, startAt: r.startAt, endAt: r.endAt, tzOffsetMin: r.tzOffsetMin,
      asleepMin: r.asleepMin, coreMin: r.coreMin, deepMin: r.deepMin, remMin: r.remMin, awakeMin: r.awakeMin,
      unspecMin: r.unspecMin, inBedMin: r.inBedMin, isNap: r.isNap === 1, source: r.source,
    }));
}

export async function getSleepPageData() {
  await connection();
  const [hrRows, hrvRows, rows, target] = await Promise.all([db.select().from(schema.heartRateDaily).all(), db.select().from(schema.hrvDaily).all(), loadSleepRows(), getSleepTarget()]);
  const hr: HrRow[] = hrRows.map((r) => ({ day: r.day, source: r.source, avg: r.avg, min: r.min, max: r.max, resting: r.resting }));
  const hrv: HrvRow[] = hrvRows.map((r) => ({ day: r.day, source: r.source, avg: r.avg }));
  return { rows, hr, hrv, target };
}
