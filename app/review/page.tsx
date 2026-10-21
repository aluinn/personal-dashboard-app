import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import Delta from "@/components/review/Delta";
import EventsAttended from "@/components/review/EventsAttended";
import { getReview } from "@/lib/db/review";
import { loadEvents } from "@/lib/events/load";
import { addDays, formatDay, londonToday, mondayOf, wallToInstant } from "@/lib/time";
import { nowMsOf } from "@/lib/db/review";
import { tonnes } from "@/lib/workouts";

const Big = ({ children }: { children: React.ReactNode }) => <div className="font-mono text-3xl font-light text-teal glow-text">{children}</div>;
const dash = (v: number | null, f: (n: number) => string) => (v === null ? "—" : f(v));

async function Data({ params }: { params: Promise<{ week?: string }> }) {
  await connection();
  const { week } = await params;
  const today = londonToday();
  const thisMon = mondayOf(today);
  const start = week && /^\d{4}-\d{2}-\d{2}$/.test(week) && week <= thisMon ? mondayOf(week) : addDays(thisMon, -7);
  const r = getReview(start, today);
  const { events } = await loadEvents(21);
  const nowMs = nowMsOf();
  const slim = events.map(({ id, title, start: s, end }) => ({ id, title, start: s, end }));
  const { a, b, cur, prev } = r;
  const live = cur.end === today && cur.end < addDays(cur.start, 6);

  const lines: string[] = [];
  if (a.sleepH !== null) lines.push(`You slept ${a.sleepH.toFixed(1)} h a night on average over ${a.nights} night${a.nights === 1 ? "" : "s"}${b.sleepH !== null ? ` (${Math.abs(a.sleepH - b.sleepH) < 0.05 ? "same as before" : `${a.sleepH > b.sleepH ? "+" : "-"}${Math.abs(a.sleepH - b.sleepH).toFixed(1)} h vs before`})` : ""}.`);
  lines.push(`${a.sessions} training session${a.sessions === 1 ? "" : "s"}${a.volumeKg > 0 ? `, ${tonnes(a.volumeKg)} lifted` : ""}${a.prs ? `, ${a.prs} new PR${a.prs === 1 ? "" : "s"}` : ""}.`);
  lines.push(`${a.applications} application${a.applications === 1 ? "" : "s"} sent.`);
  if (a.caffeineAvg !== null) lines.push(`Caffeine averaged ${Math.round(a.caffeineAvg)} mg on the days you logged it${a.caffeineOver ? `, over your limit on ${a.caffeineOver}` : ""}.`);
  if (a.habitPct !== null) lines.push(`Habits ticked ${a.habitPct}% of the time.`);

  const tabs = [
    { label: "This week so far", w: thisMon },
    { label: "Last week", w: addDays(thisMon, -7) },
    { label: "2 weeks ago", w: addDays(thisMon, -14) },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link key={t.w} href={`/review?week=${t.w}`} className={`btn ${t.w === start ? "bg-teal/15" : "!border-line !text-muted"}`}>{t.label}</Link>
        ))}
      </div>
      <Panel label={`SUMMARY // ${formatDay(cur.start)} – ${formatDay(cur.end)}`} accent="violet">
        <ul className="list-disc space-y-1 pl-5 text-sm">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
        <p className="micro mt-3 normal-case tracking-wide !text-[10px]">
          Compared with {formatDay(prev.start)} – {formatDay(prev.end)} ({cur.days} day{cur.days === 1 ? "" : "s"} each){live ? ", so the week so far isn't judged against a full week" : ""}.
        </p>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel label="SLEEP">
          <Big>{dash(a.sleepH, (n) => `${n.toFixed(1)}h`)}</Big>
          <Delta cur={a.sleepH} prev={b.sleepH} unit="h" digits={1} />
          <div className="mt-3 text-sm">Score <span className="font-mono text-teal">{dash(a.sleepScore, (n) => String(Math.round(n)))}</span> <Delta cur={a.sleepScore} prev={b.sleepScore} /></div>
          <div className="micro mt-1">{a.nights} nights logged</div>
        </Panel>
        <Panel label="WORKOUTS">
          <Big>{a.sessions}</Big>
          <Delta cur={a.sessions} prev={b.sessions} />
          <div className="mt-3 text-sm">Volume <span className="font-mono text-teal">{tonnes(a.volumeKg)}</span> <Delta cur={a.volumeKg / 1000} prev={b.volumeKg / 1000} unit=" t" digits={1} /></div>
          <div className="text-sm">{a.trainingMin} min training · {a.prs} PR{a.prs === 1 ? "" : "s"}</div>
        </Panel>
        <Panel label="APPLICATIONS SENT">
          <Big>{a.applications}</Big>
          <Delta cur={a.applications} prev={b.applications} />
          <p className="micro mt-3 normal-case tracking-wide !text-[10px]">Counted from when a listing first moved to Applied (or later). Anything moved before this feature existed isn’t counted.</p>
        </Panel>
        <Panel label="EVENTS ATTENDED">
          <EventsAttended events={slim} now={nowMs} curStart={wallToInstant(cur.start, "00:00")} curEnd={wallToInstant(addDays(cur.end, 1), "00:00")} prevStart={wallToInstant(prev.start, "00:00")} prevEnd={wallToInstant(addDays(prev.end, 1), "00:00")} />
        </Panel>
        <Panel label="STIMULANTS">
          <Big>{dash(a.caffeineAvg, (n) => `${Math.round(n)} mg`)}</Big>
          <Delta cur={a.caffeineAvg} prev={b.caffeineAvg} better="down" unit=" mg" />
          <div className="mt-3 text-sm">Velo <span className="font-mono text-teal">{a.nicotine}</span> <Delta cur={a.nicotine} prev={b.nicotine} better="down" /></div>
        </Panel>
        <Panel label="HABITS">
          <Big>{dash(a.habitPct, (n) => `${n}%`)}</Big>
          <Delta cur={a.habitPct} prev={b.habitPct} unit="%" />
        </Panel>
      </div>
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  return (
    <>
      <PageHeader code="12 // REVIEW" title="Weekly Review" />
      <Suspense fallback={<div className="micro">Loading…</div>}><Data params={searchParams} /></Suspense>
    </>
  );
}
