import "server-only";
import { getSetting, setSetting } from "./opp";
import { DEFAULT_TERM_DATES, TERMS, type TermDates } from "@/lib/academic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function getTermDates(): Promise<TermDates> {
  const saved = await getSetting<Partial<TermDates>>("termDates", {});
  const out = { ...DEFAULT_TERM_DATES };
  for (const t of TERMS) {
    const s = saved[t];
    if (s && DATE.test(s.start) && DATE.test(s.end) && s.start < s.end) out[t] = s;
  }
  return out;
}

export async function saveTermDates(f: FormData) {
  const out: Record<string, { start: string; end: string }> = {};
  for (const t of TERMS) {
    const start = String(f.get(`start_${t}`) ?? "");
    const end = String(f.get(`end_${t}`) ?? "");
    if (DATE.test(start) && DATE.test(end) && start < end) out[t] = { start, end };
  }
  await setSetting("termDates", out);
}
