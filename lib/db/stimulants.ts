import "server-only";
import { db } from "./index";
import { getSetting } from "./opp";
import { DEFAULT_STIM, type StimSettings } from "@/lib/stimulants";
import { loadSleepRows } from "./health";
import { buildNights } from "@/lib/sleep";
import { londonDate } from "@/lib/time";

export type StimLog = { id: number; kind: "caffeine" | "nicotine"; label: string; mg: number; at: number };

export const getStimSettings = (): StimSettings => ({
  cutoff: getSetting("caffeineCutoff", DEFAULT_STIM.cutoff),
  delayMin: getSetting("caffeineDelayMin", DEFAULT_STIM.delayMin),
  maxMg: getSetting("caffeineMaxMg", DEFAULT_STIM.maxMg),
});

export function stimLogsSince(ms: number): StimLog[] {
  return (db.$client.prepare("SELECT id, kind, label, amount_mg AS mg, at FROM stimulant_logs WHERE at >= ? ORDER BY at DESC").all(ms) as StimLog[]);
}

/** When you woke today (London), from your latest imported/manual sleep, else null. */
export function wakeTimeToday(now = Date.now()): number | null {
  const nights = buildNights(loadSleepRows());
  const last = nights[nights.length - 1];
  if (!last?.endAt) return null;
  return londonDate(last.endAt) === londonDate(now) ? last.endAt : null;
}

/** Logs from the last `days` days (computed here so components don't read the clock during render). */
export const stimLogsLastDays = (days: number): StimLog[] => stimLogsSince(Date.now() - days * 86400_000);
