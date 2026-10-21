import type { SleepNight } from "./types";

export type SegKind = "inbed" | "core" | "deep" | "rem" | "awake" | "unspec";
export type Segment = { startMs: number; endMs: number; kind: SegKind; tzOffsetMin: number };

// Overlapping segments (Watch stages + iPhone "in bed" / "asleep") are resolved minute by minute:
// a stage the Watch measured beats "asleep, unspecified", which beats "in bed". No double counting.
const PRIORITY: Record<SegKind, number> = { core: 4, deep: 4, rem: 4, awake: 3, unspec: 2, inbed: 1 };
const KINDS: SegKind[] = ["inbed", "unspec", "awake", "core", "deep", "rem"];
const GAP_MS = 90 * 60_000; // gaps under 90 min stay within one night's sleep

const localDate = (ms: number, off: number) => new Date(ms + off * 60_000).toISOString().slice(0, 10);
const localHour = (ms: number, off: number) => (((ms + off * 60_000) / 3_600_000) % 24 + 24) % 24;

/** Group raw segments into sleep sessions (nights and naps). */
export function buildSessions(segments: Segment[]): SleepNight[] {
  const segs = [...segments].filter((s) => s.endMs > s.startMs).sort((a, b) => a.startMs - b.startMs);
  const clusters: Segment[][] = [];
  let end = -Infinity;
  for (const s of segs) {
    if (clusters.length === 0 || s.startMs - end > GAP_MS) clusters.push([]);
    clusters[clusters.length - 1].push(s);
    end = Math.max(end, s.endMs);
  }

  const out: SleepNight[] = [];
  for (const c of clusters) {
    const t0 = Math.floor(Math.min(...c.map((s) => s.startMs)) / 60_000);
    const t1 = Math.ceil(Math.max(...c.map((s) => s.endMs)) / 60_000);
    const n = t1 - t0;
    if (n <= 0 || n > 24 * 60) continue;
    const prio = new Uint8Array(n);
    const kind = new Uint8Array(n);
    for (const s of c) {
      const a = Math.floor(s.startMs / 60_000) - t0;
      const b = Math.ceil(s.endMs / 60_000) - t0;
      const p = PRIORITY[s.kind];
      const k = KINDS.indexOf(s.kind);
      for (let m = Math.max(0, a); m < Math.min(n, b); m++) {
        if (p > prio[m]) {
          prio[m] = p;
          kind[m] = k;
        }
      }
    }
    const mins: Record<SegKind, number> = { inbed: 0, unspec: 0, awake: 0, core: 0, deep: 0, rem: 0 };
    let first = -1;
    let last = -1;
    for (let m = 0; m < n; m++) {
      if (prio[m] === 0) continue;
      const k = KINDS[kind[m]];
      mins[k]++;
      if (k !== "inbed" && k !== "awake") {
        if (first < 0) first = m;
        last = m;
      }
    }
    // iPhone-only history has just "in bed": treat it as unspecified sleep rather than dropping the night.
    let unspec = mins.unspec;
    if (mins.core + mins.deep + mins.rem + mins.unspec === 0) {
      if (mins.inbed === 0) continue;
      unspec = mins.inbed;
      first = kind.findIndex((_, i) => prio[i] > 0);
      last = n - 1 - [...prio].reverse().findIndex((p) => p > 0);
    }
    const asleep = mins.core + mins.deep + mins.rem + unspec;
    if (asleep < 20) continue; // ignore blips
    const off = c[c.length - 1].tzOffsetMin;
    const startAt = (t0 + first) * 60_000;
    const endAt = (t0 + last + 1) * 60_000;
    const h = localHour(startAt, off);
    out.push({
      nightDate: localDate(endAt, off),
      startAt,
      endAt,
      tzOffsetMin: off,
      asleepMin: asleep,
      coreMin: mins.core,
      deepMin: mins.deep,
      remMin: mins.rem,
      awakeMin: mins.awake,
      unspecMin: unspec,
      inBedMin: mins.inbed + mins.unspec + mins.awake + mins.core + mins.deep + mins.rem, // every minute covered by any record
      isNap: asleep < 180 && h >= 9 && h < 20,
      index: 0,
    });
  }

  // number sessions within the same night so each gets a stable dedupe key
  const seen = new Map<string, number>();
  for (const s of out.sort((a, b) => (a.startAt ?? 0) - (b.startAt ?? 0))) {
    const k = `${s.nightDate}|${s.isNap}`;
    s.index = seen.get(k) ?? 0;
    seen.set(k, s.index + 1);
  }
  return out;
}
