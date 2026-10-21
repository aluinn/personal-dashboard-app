import type { TimetableData } from "@/lib/db/types";
import { addDays, londonDate, weekdayOf } from "@/lib/time";

const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const local = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

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

const VTIMEZONE = `BEGIN:VTIMEZONE
TZID:Europe/London
BEGIN:DAYLIGHT
TZOFFSETFROM:+0000
TZOFFSETTO:+0100
TZNAME:BST
DTSTART:19700329T010000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0100
TZOFFSETTO:+0000
TZNAME:GMT
DTSTART:19701025T020000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`.split("\n");

export function buildIcs({ modules, sessions, assessments }: TimetableData, nowMs = Date.now()) {
  const mods = new Map(modules.map((m) => [m.id, m]));
  // e.g. 20261020T165603Z
  const stamp = new Date(nowMs).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const today = londonDate(nowMs);
  const L: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aluinn Dashboard//Timetable//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:UCL Timetable",
    "X-WR-TIMEZONE:Europe/London",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...VTIMEZONE,
  ];

  for (const s of sessions) {
    const m = s.moduleId ? mods.get(s.moduleId) : undefined;
    const where = [s.room, s.location].filter(Boolean).join(", ");
    const lecturer = s.lecturer || m?.lecturer || "";
    const desc = [lecturer && `Lecturer: ${lecturer}`, m?.notionUrl && `Notes: ${m.notionUrl}`].filter(Boolean).join("\n");

    let first: string;
    if (s.date) first = s.date;
    else {
      // first occurrence on/after today
      const offset = (((s.weekday ?? 0) - weekdayOf(today)) + 7) % 7;
      first = addDays(today, offset);
    }
    L.push(
      "BEGIN:VEVENT",
      `UID:session-${s.id}@aluinn-dashboard`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/London:${local(first, s.startTime)}`,
      `DTEND;TZID=Europe/London:${local(first, s.endTime)}`,
      `SUMMARY:${esc(s.title)}`,
    );
    if (!s.date) L.push(`RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[s.weekday ?? 0]}`);
    if (where) L.push(`LOCATION:${esc(where)}`);
    if (desc) L.push(`DESCRIPTION:${esc(desc)}`);
    L.push("END:VEVENT");
  }

  for (const a of assessments) {
    const m = mods.get(a.moduleId);
    const [h, mi] = a.dueTime.split(":").map(Number);
    const endMin = h * 60 + mi + 15;
    const endTime = `${String(Math.min(23, Math.floor(endMin / 60))).padStart(2, "0")}:${String(endMin >= 1440 ? 59 : endMin % 60).padStart(2, "0")}`;
    L.push(
      "BEGIN:VEVENT",
      `UID:assessment-${a.id}@aluinn-dashboard`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/London:${local(a.dueDate, a.dueTime)}`,
      `DTEND;TZID=Europe/London:${local(a.dueDate, endTime)}`,
      `SUMMARY:${esc(`DUE: ${a.title}${m ? ` (${m.code})` : ""}`)}`,
      a.weight ? `DESCRIPTION:${esc(`Weighting ${a.weight}%`)}` : "DESCRIPTION:",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(a.title)}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "END:VEVENT",
    );
  }

  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}
