// All schedule maths happens in Europe/London wall-clock time.
export const TZ = "Europe/London";

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function londonParts(ms: number) {
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(ms)) p[x.type] = x.value;
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function londonDate(ms: number) {
  const p = londonParts(ms);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

export const londonToday = () => londonDate(Date.now());

export function londonMinutes(ms: number) {
  const p = londonParts(ms);
  return p.h * 60 + p.mi + p.s / 60;
}

/** London wall time ("2026-10-20", "09:00") -> real UTC milliseconds. */
export function wallToInstant(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const target = Date.UTC(y, m - 1, d, h, mi);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = londonParts(guess);
    guess += target - Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  }
  return guess;
}

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function mondayOf(date: string) {
  return addDays(date, -weekdayOf(date));
}

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function formatDay(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
}

export function formatCountdown(ms: number) {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const dd = Math.floor(h / 24);
  const hh = h % 24;
  return hh ? `${dd}d ${hh}h` : `${dd}d`;
}
