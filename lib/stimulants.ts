import { formatCountdown, wallToInstant } from "@/lib/time";

// Typical amounts, not lab values. Every log can be edited on entry.
export const PRESETS = [
  { kind: "caffeine", label: "Coffee", mg: 95 },
  { kind: "caffeine", label: "Espresso", mg: 63 },
  { kind: "caffeine", label: "Tea", mg: 40 },
  { kind: "caffeine", label: "Red Bull", mg: 80 }, // 250 ml can
  { kind: "caffeine", label: "Red Bull (355 ml)", mg: 114 },
  { kind: "caffeine", label: "Energy drink", mg: 80 },
  { kind: "nicotine", label: "Velo", mg: 10 },
] as const;

export type StimSettings = { cutoff: string; delayMin: number; maxMg: number };
export const DEFAULT_STIM: StimSettings = { cutoff: "14:00", delayMin: 90, maxMg: 400 };

export type Window =
  | { state: "opens"; at: number; text: string }
  | { state: "open"; until: number; text: string }
  | { state: "closed"; text: string };

/**
 * Caffeine window for today (London). Opens `delayMin` after you woke (a common tip is to wait
 * ~90 min so caffeine doesn't just mask sleep pressure); closes at your cut-off time.
 * With no wake time known (no sleep data for today) the delay is skipped.
 */
export function caffeineWindow(now: number, today: string, wakeAt: number | null, s: StimSettings): Window {
  const closes = wallToInstant(today, s.cutoff);
  const opens = wakeAt && s.delayMin > 0 ? wakeAt + s.delayMin * 60_000 : null;
  if (now >= closes) return { state: "closed", text: `Past your ${s.cutoff} cut-off: no more caffeine today` };
  if (opens && now < opens) return { state: "opens", at: opens, text: `Caffeine window opens in ${formatCountdown(opens - now)}` };
  return { state: "open", until: closes, text: `Caffeine OK for ${formatCountdown(closes - now)} (until ${s.cutoff})` };
}
