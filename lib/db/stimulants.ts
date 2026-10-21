import "server-only";
import { q } from "./index";
import { getSetting } from "./opp";
import { DEFAULT_STIM, type StimSettings } from "@/lib/stimulants";
import { loadSleepRows } from "./health";
import { buildNights } from "@/lib/sleep";
import { londonDate } from "@/lib/time";

export type StimLog = { id: number; kind: "caffeine" | "nicotine"; label: string; mg: number; at: number };

export async function getStimSettings(): Promise<StimSettings> {
  const [cutoff, delayMin, maxMg] = await Promise.all([
    getSetting("caffeineCutoff", DEFAULT_STIM.cutoff),
    getSetting("caffeineDelayMin", DEFAULT_STIM.delayMin),
    getSetting("caffeineMaxMg", DEFAULT_STIM.maxMg),
  ]);
  return { cutoff, delayMin, maxMg };
}

export function stimLogsSince(ms: number) {
  return q.all<StimLog>("SELECT id, kind, label, amount_mg AS mg, at FROM stimulant_logs WHERE at >= ? ORDER BY at DESC", [ms]);
}

/** When you woke today (London), from your latest imported/manual sleep, else null. */
export async function wakeTimeToday(now = Date.now()): Promise<number | null> {
  const nights = buildNights(await loadSleepRows());
  const last = nights[nights.length - 1];
  if (!last?.endAt) return null;
  return londonDate(last.endAt) === londonDate(now) ? last.endAt : null;
}

/** Logs from the last `days` days (computed here so components don't read the clock during render). */
export const stimLogsLastDays = (days: number) => stimLogsSince(Date.now() - days * 86400_000);
