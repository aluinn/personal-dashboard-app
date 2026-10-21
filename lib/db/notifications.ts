import "server-only";
import { db } from "./index";
import { getTimetableData } from "./queries";
import { getStimSettings, stimLogsSince } from "./stimulants";
import { listOpportunities } from "./opp";
import { expandSessions, pickNext, withDue } from "@/lib/schedule";
import { daysBetween } from "@/lib/opp";
import type { Notif } from "@/lib/notifications";
import { formatCountdown, londonDate, wallToInstant } from "@/lib/time";

const DAY = 86400_000;

/** Everything worth flagging right now. Recomputed on each poll, nothing is stored. */
export async function getNotifications(now = Date.now()): Promise<Notif[]> {
  const out: Notif[] = [];
  const today = londonDate(now);
  const { sessions, assessments } = await getTimetableData();

  // Class starting within the hour (or already running and just started).
  const next = pickNext(expandSessions(sessions, today, 2), now);
  if (next && !next.live && next.occ.start - now <= 60 * 60_000) {
    const room = next.occ.room ? ` · ${next.occ.room}` : "";
    out.push({
      id: `class:${next.occ.key}`, kind: "class", severity: "warn", push: true,
      title: `${next.occ.title.replace(/^HPSC\d+\s/, "")} in ${formatCountdown(next.occ.start - now)}`,
      detail: `${next.occ.startTime}–${next.occ.endTime}${room}`, href: "/timetable",
    });
  }

  // Caffeine cut-off: a heads-up 30 min before, then "stop now" for 4 hours after.
  const s = getStimSettings();
  const cutoff = wallToInstant(today, s.cutoff);
  const caffeineToday = stimLogsSince(now - 36 * 3600_000).filter((l) => l.kind === "caffeine" && londonDate(l.at) === today);
  if (now >= cutoff - 30 * 60_000 && now < cutoff) {
    out.push({ id: `caf:soon:${today}`, kind: "caffeine", severity: "warn", push: true, title: `Caffeine cut-off in ${formatCountdown(cutoff - now)}`, detail: `Last call before ${s.cutoff}`, href: "/stimulants" });
  } else if (now >= cutoff && now < cutoff + 4 * 3600_000) {
    out.push({ id: `caf:stop:${today}`, kind: "caffeine", severity: "alert", push: true, title: "Stop caffeine now", detail: `Past your ${s.cutoff} cut-off${caffeineToday.length ? "" : " (nothing logged today)"}`, href: "/stimulants" });
  }

  // Deadlines within 7 days: assessments + saved (not yet applied) opportunities.
  for (const a of withDue(assessments)) {
    if (a.dueAt < now || a.dueAt > now + 7 * DAY) continue;
    out.push({ id: `due:a:${a.id}`, kind: "deadline", severity: a.dueAt - now < 2 * DAY ? "alert" : "warn", title: `Due in ${formatCountdown(a.dueAt - now)}: ${a.title}`, detail: `${a.dueDate} ${a.dueTime}`, href: "/timetable" });
  }
  for (const o of listOpportunities()) {
    if (o.status !== "saved" || !o.deadline) continue;
    const d = daysBetween(today, o.deadline);
    if (d < 0 || d > 7) continue;
    out.push({ id: `due:o:${o.id}`, kind: "deadline", severity: d <= 2 ? "alert" : "warn", title: `${o.firm} closes ${d === 0 ? "today" : `in ${d}d`}`, detail: o.role, href: "/opportunities" });
  }

  // New in the feed in the last 24h.
  const fresh = (db.$client.prepare("SELECT COUNT(*) n FROM opportunities WHERE status = 'feed' AND created_at >= ?").get(now - DAY) as { n: number }).n;
  if (fresh > 0) out.push({ id: `opp:new:${today}:${fresh}`, kind: "opportunity", severity: "info", title: `${fresh} new ${fresh === 1 ? "opportunity" : "opportunities"} in your feed`, detail: "Added in the last 24 hours", href: "/opportunities" });

  const rank = { alert: 0, warn: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
