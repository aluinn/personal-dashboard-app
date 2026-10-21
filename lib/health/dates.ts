/** "2026-10-19 23:10:00 +0100" (Apple export and Health Auto Export both use this) -> UTC ms + offset. */
export function parseHealthDate(s: string): { ms: number; tzOffsetMin: number; day: string } | null {
  const m = s.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/);
  if (!m) {
    const d = s.trim().match(/^(\d{4}-\d{2}-\d{2})$/);
    return d ? { ms: Date.parse(`${d[1]}T00:00:00Z`), tzOffsetMin: 0, day: d[1] } : null;
  }
  const time = m[2].length === 5 ? `${m[2]}:00` : m[2];
  const tz = m[3] ?? "Z";
  let off = 0;
  let iso = "Z";
  if (tz !== "Z") {
    const sign = tz[0] === "-" ? -1 : 1;
    const digits = tz.slice(1).replace(":", "");
    off = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2)));
    iso = `${tz[0]}${digits.slice(0, 2)}:${digits.slice(2)}`;
  }
  const ms = Date.parse(`${m[1]}T${time}${iso}`);
  return Number.isFinite(ms) ? { ms, tzOffsetMin: off, day: m[1] } : null;
}
