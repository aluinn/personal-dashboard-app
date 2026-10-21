import { addDays } from "@/lib/time";

// Everything academic is tagged with a year of study so Year 3 can be added later without
// restructuring: `year` is a column on modules, notes and assessments.
export const CURRENT_YEAR = 2;
export const YEAR_LABEL: Record<number, string> = { 1: "2025-26", 2: "2026-27", 3: "2027-28" };

export const TERMS = ["Term 1", "Term 2", "Term 3"] as const;
export type TermName = (typeof TERMS)[number];
export const MODULE_TERMS = [...TERMS, "All terms"] as const;

export type TermDates = Record<TermName, { start: string; end: string }>;

// Approximate 2026-27 term dates (Mondays to Fridays), by analogy with UCL's published pattern; they
// are NOT copied from UCL's calendar for that year. Check them and edit in Settings.
export const DEFAULT_TERM_DATES: TermDates = {
  "Term 1": { start: "2026-09-21", end: "2026-12-11" },
  "Term 2": { start: "2027-01-11", end: "2027-03-26" },
  "Term 3": { start: "2027-04-26", end: "2027-06-11" },
};

/** Which term a date falls in. Gaps (holidays) belong to the term that just finished. */
export function termOf(date: string, terms: TermDates = DEFAULT_TERM_DATES): TermName {
  if (date < terms["Term 1"].start) return "Term 1";
  let last: TermName = "Term 1";
  for (const t of TERMS) {
    if (date >= terms[t].start) last = t;
  }
  return last;
}

/** 1-based teaching week of the term containing `date` (0 if before it starts, capped at 12). */
export function weekOfTerm(date: string, terms: TermDates = DEFAULT_TERM_DATES): number {
  const t = termOf(date, terms);
  const days = Math.round((Date.parse(date) - Date.parse(terms[t].start)) / 86400000);
  return Math.max(0, Math.min(12, Math.floor(days / 7) + 1));
}

export function termWeeks(t: TermName, terms: TermDates = DEFAULT_TERM_DATES) {
  return Math.max(1, Math.round((Date.parse(addDays(terms[t].end, 3)) - Date.parse(terms[t].start)) / (7 * 86400000)));
}
