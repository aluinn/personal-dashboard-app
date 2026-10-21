// Minimal iCalendar (RFC 5545) reader for public event feeds. Pure: no I/O.
// Recurrence rules are ignored (Luma publishes each occurrence as its own VEVENT).

export type RawEvent = {
  uid: string;
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  location: string;
  description: string;
  url: string;
  organizer: string;
  geo: [number, number] | null;
  cancelled: boolean;
};

function unfold(text: string) {
  return text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function unescapeText(s: string) {
  return s.replace(/\\([nN,;\\])/g, (_, c) => (c === "n" || c === "N" ? "\n" : c));
}

type Prop = { name: string; params: Record<string, string>; value: string };

function parseLine(line: string): Prop | null {
  // name[;param=value]*:value, where values may be "quoted" and contain : or ;
  let i = 0;
  let inQuote = false;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) break;
  }
  if (i >= line.length) return null;
  const head = line.slice(0, i);
  const value = line.slice(i + 1);
  const parts: string[] = [];
  let cur = "";
  inQuote = false;
  for (const c of head) {
    if (c === '"') inQuote = !inQuote;
    if (c === ";" && !inQuote) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  parts.push(cur);
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: parts[0].toUpperCase(), params, value };
}

/** Wall-clock time in an IANA zone -> UTC ms. Falls back to London if the zone is unknown. */
export function zonedToInstant(y: number, mo: number, d: number, h: number, mi: number, tz: string) {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
  } catch {
    return zonedToInstant(y, mo, d, h, mi, "Europe/London");
  }
  const target = Date.UTC(y, mo - 1, d, h, mi);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p: Record<string, number> = {};
    for (const x of fmt.formatToParts(guess)) if (x.type !== "literal") p[x.type] = +x.value;
    guess += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  return guess;
}

function parseDateValue(p: Prop): { ms: number; allDay: boolean } | null {
  const m = p.value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (m[4] === undefined) return { ms: zonedToInstant(y, mo, d, 0, 0, "Europe/London"), allDay: true };
  const [h, mi] = [+m[4], +m[5]];
  if (m[7]) return { ms: Date.UTC(y, mo - 1, d, h, mi), allDay: false };
  return { ms: zonedToInstant(y, mo, d, h, mi, p.params.TZID || "Europe/London"), allDay: false };
}

export function parseIcs(text: string): RawEvent[] {
  const out: RawEvent[] = [];
  let cur: Record<string, Prop> | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur?.DTSTART && cur.SUMMARY) {
        const s = parseDateValue(cur.DTSTART);
        if (s) {
          const e = cur.DTEND ? parseDateValue(cur.DTEND) : null;
          const end = e && e.ms > s.ms ? e.ms : s.allDay ? s.ms + 86400_000 : s.ms + 3600_000;
          const geo = cur.GEO?.value.split(";").map(Number);
          out.push({
            uid: cur.UID?.value ?? "",
            title: unescapeText(cur.SUMMARY.value).trim(),
            start: s.ms,
            end,
            allDay: s.allDay,
            location: unescapeText(cur.LOCATION?.value ?? "").trim(),
            description: unescapeText(cur.DESCRIPTION?.value ?? "").trim(),
            url: (cur.URL?.value ?? "").trim(),
            organizer: (cur.ORGANIZER?.params.CN ?? "").trim(),
            geo: geo && geo.length === 2 && geo.every(Number.isFinite) ? [geo[0], geo[1]] : null,
            cancelled: (cur.STATUS?.value ?? "").toUpperCase() === "CANCELLED",
          });
        }
      }
      cur = null;
    } else if (cur) {
      const p = parseLine(line);
      if (p && !(p.name in cur)) cur[p.name] = p;
    }
  }
  return out;
}
