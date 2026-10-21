import type { TechEvent } from "./types";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");

function fold(line: string) {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  parts.push(rest);
  return parts.join("\r\n");
}

/** A single-event .ics file that Apple Calendar / Google Calendar will import. */
export function eventIcs(e: TechEvent, nowMs = Date.now()) {
  const desc = [e.host && `Hosted by ${e.host}`, e.url && `RSVP: ${e.url}`].filter(Boolean).join("\n");
  const L = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aluinn Dashboard//Tech Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id.replace(/[^A-Za-z0-9@._-]/g, "")}@aluinn-dashboard`,
    `DTSTAMP:${utc(nowMs)}`,
    // All-day entries come from London midnight; the UTC date can be the day before in BST.
    e.allDay ? `DTSTART;VALUE=DATE:${day(e.start + 6 * 3600_000)}` : `DTSTART:${utc(e.start)}`,
    e.allDay ? `DTEND;VALUE=DATE:${day(e.end + 6 * 3600_000)}` : `DTEND:${utc(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    e.venue && `LOCATION:${esc(e.venue)}`,
    desc && `DESCRIPTION:${esc(desc)}`,
    e.url && `URL:${e.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean) as string[];
  return L.map(fold).join("\r\n") + "\r\n";
}

export const eventFileName = (e: TechEvent) =>
  (e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "event") + ".ics";
