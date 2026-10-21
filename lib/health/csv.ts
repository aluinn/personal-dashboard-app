// Generic health CSV importer (built for Health Auto Export CSVs but header-driven, so spreadsheets
// and other apps work too). I couldn't find Health Auto Export's published CSV column names, so
// columns are recognised by keywords in the header and the result reports exactly which columns
// were used and which were ignored: nothing is guessed silently.
import { parseDelimited } from "@/lib/sources/import";
import { parseDate } from "@/lib/sources/dates";
import { parseHealthDate } from "./dates";
import { emptyBatch, type HealthBatch } from "./types";

type Field =
  | "asleep" | "core" | "deep" | "rem" | "awake" | "inBed" | "sleepStart" | "sleepEnd"
  | "hrAvg" | "hrMin" | "hrMax" | "resting" | "hrv" | "steps" | "kcal";

function classify(header: string): Field | null {
  // drop "(count/min)"-style units first, otherwise "min" in a unit looks like the Min column
  const h = header.toLowerCase().replace(/\([^)]*\)/g, " ");
  if (/in ?bed ?(start|end)/.test(h)) return null;
  if (/sleep ?start/.test(h)) return "sleepStart";
  if (/sleep ?end/.test(h)) return "sleepEnd";
  if (/in ?bed/.test(h)) return "inBed";
  if (/\bdeep\b/.test(h)) return "deep";
  if (/\brem\b/.test(h)) return "rem";
  if (/\bcore\b/.test(h)) return "core";
  if (/\bawake\b/.test(h)) return "awake";
  if (/total sleep|asleep|sleep duration|sleep analysis|^sleep\b/.test(h)) return "asleep";
  if (/resting heart/.test(h)) return "resting";
  if (/heart rate variab|\bhrv\b/.test(h)) return "hrv";
  if (/heart rate|heartrate/.test(h)) return /\bmin\b|\[min\]/.test(h) ? "hrMin" : /\bmax\b|\[max\]/.test(h) ? "hrMax" : "hrAvg";
  if (/step/.test(h)) return "steps";
  if (/active energy|active calories/.test(h)) return "kcal";
  return null;
}

const toNum = (s: string) => {
  const n = Number(String(s).replace(/,/g, "").trim());
  return s.trim() !== "" && Number.isFinite(n) ? n : null;
};

export function mapHealthCsv(text: string): { batch: HealthBatch; recognised: string[]; ignored: string[]; rows: number; error?: string } {
  const batch = emptyBatch();
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = first.includes("\t") ? "\t" : (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const table = parseDelimited(text.replace(/^﻿/, ""), delim);
  if (table.length < 2) return { batch, recognised: [], ignored: [], rows: 0, error: "Need a header row and at least one data row." };

  const headers = table[0].map((h) => h.trim());
  let dateCol = headers.findIndex((h) => /^(date|day|date\/time|start ?date|start|time)$/i.test(h));
  if (dateCol < 0) dateCol = 0;
  const fields = new Map<number, Field>();
  const recognised: string[] = [];
  const ignored: string[] = [];
  headers.forEach((h, i) => {
    if (i === dateCol) return;
    const f = classify(h);
    if (f && ![...fields.values()].includes(f)) {
      fields.set(i, f);
      recognised.push(`${h} → ${f}`);
    } else ignored.push(h);
  });
  if (fields.size === 0) {
    return { batch, recognised, ignored, rows: 0, error: `No recognisable health columns. Headers seen: ${headers.join(", ")}` };
  }

  // minutes if header says min, hours if it says hr/h, otherwise guess from magnitude
  const unitOf = (i: number): "min" | "hr" | "auto" => (/\(\s*min/i.test(headers[i]) ? "min" : /\(\s*h/i.test(headers[i]) ? "hr" : "auto");
  const minutes = (i: number, v: number) => (unitOf(i) === "min" ? v : unitOf(i) === "hr" ? v * 60 : v > 24 ? v : v * 60);

  let rows = 0;
  for (const r of table.slice(1)) {
    const raw = (r[dateCol] ?? "").trim();
    const day = parseHealthDate(raw)?.day ?? parseDate(raw);
    if (!day) continue;
    rows++;
    const v: Partial<Record<Field, number>> = {};
    let start: ReturnType<typeof parseHealthDate> = null;
    let end: ReturnType<typeof parseHealthDate> = null;
    for (const [i, f] of fields) {
      const cell = r[i] ?? "";
      if (f === "sleepStart") start = parseHealthDate(cell);
      else if (f === "sleepEnd") end = parseHealthDate(cell);
      else {
        const n = toNum(cell);
        if (n !== null) v[f] = n;
      }
    }
    const mins = (f: Field) => {
      const idx = [...fields].find(([, x]) => x === f)?.[0];
      return v[f] === undefined || idx === undefined ? null : minutes(idx, v[f]!);
    };
    const core = mins("core") ?? 0;
    const deep = mins("deep") ?? 0;
    const rem = mins("rem") ?? 0;
    const asleep = mins("asleep") ?? (core + deep + rem || null);
    if (asleep !== null && asleep >= 20) {
      batch.sleep.push({
        nightDate: end?.day ?? day,
        startAt: start?.ms ?? null,
        endAt: end?.ms ?? null,
        tzOffsetMin: (end ?? start)?.tzOffsetMin ?? 0,
        asleepMin: asleep,
        coreMin: core,
        deepMin: deep,
        remMin: rem,
        awakeMin: mins("awake") ?? 0,
        unspecMin: Math.max(0, asleep - core - deep - rem),
        inBedMin: mins("inBed") ?? asleep,
        isNap: false,
        index: 0,
      });
    }
    if (v.hrAvg !== undefined || v.hrMin !== undefined || v.hrMax !== undefined || v.resting !== undefined)
      batch.hr.push({ day, avg: v.hrAvg ?? null, min: v.hrMin ?? null, max: v.hrMax ?? null, resting: v.resting ?? null });
    if (v.hrv !== undefined) batch.hrv.push({ day, avg: v.hrv });
    if (v.steps !== undefined || v.kcal !== undefined) batch.steps.push({ day, steps: v.steps ?? null, activeKcal: v.kcal ?? null });
  }
  return { batch, recognised, ignored, rows };
}
