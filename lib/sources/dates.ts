const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const valid = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/**
 * Parse the date formats UK job lists use: 2026-11-05, 05/11/2026 (day first), 5 Nov 2026,
 * 5th November 2026, Nov 5 2026, "5 Nov" (no year -> next sensible occurrence).
 * Returns YYYY-MM-DD or null.
 */
export function parseDate(input: string | undefined | null, today = new Date()): string | null {
  if (!input) return null;
  const s = String(input).trim().replace(/(\d)(st|nd|rd|th)\b/gi, "$1").replace(/,/g, " ").replace(/\s+/g, " ");
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m && valid(+m[1], +m[2], +m[3])) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return valid(y, +m[2], +m[1]) ? `${y}-${pad(+m[2])}-${pad(+m[1])}` : null;
  }
  const tryNamed = (day: number, mon: string, year?: number) => {
    const mi = MONTHS.indexOf(mon.slice(0, 3).toLowerCase());
    if (mi < 0) return null;
    let y = year;
    if (y === undefined) {
      y = today.getUTCFullYear();
      // no year given: if that date is more than ~60 days in the past, it means next year
      if (Date.UTC(y, mi, day) < today.getTime() - 60 * 86400000) y += 1;
    }
    return valid(y, mi + 1, day) ? `${y}-${pad(mi + 1)}-${pad(day)}` : null;
  };
  m = s.match(/(\d{1,2}) ([A-Za-z]{3,9})(?: (\d{4}))?/);
  if (m) return tryNamed(+m[1], m[2], m[3] ? +m[3] : undefined);
  m = s.match(/([A-Za-z]{3,9}) (\d{1,2})(?: (\d{4}))?/);
  if (m) return tryNamed(+m[2], m[1], m[3] ? +m[3] : undefined);
  return null;
}
