"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Panel from "@/components/ui/Panel";
import { clashesFor } from "@/lib/events/clash";
import { useEventMarks } from "@/lib/events/marks";
import { TOPICS, type Block, type FeedStatus, type TechEvent, type TopicKey } from "@/lib/events/types";
import { addDays, londonDate, mondayOf, wallToInstant } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import DensityMap from "./DensityMap";
import EventCard from "./EventCard";

type When = "all" | "week" | "month";
type Where = "all" | "in-person" | "online";

const Seg = <T extends string>({ value, set, options }: { value: T; set: (v: T) => void; options: [T, string][] }) => (
  <div className="flex gap-1">
    {options.map(([k, label]) => (
      <button key={k} onClick={() => set(k)} className={`btn ${value === k ? "bg-teal/15" : "!border-line !text-muted"}`}>
        {label}
      </button>
    ))}
  </div>
);

export default function EventsView({
  events,
  feeds,
  problems,
  blocks,
  configured,
}: {
  events: TechEvent[];
  feeds: FeedStatus[];
  problems: string[];
  blocks: Block[];
  configured: boolean;
}) {
  const now = useNow(60000);
  const { marks, toggle } = useEventMarks();
  const [when, setWhen] = useState<When>("all");
  const [where, setWhere] = useState<Where>("all");
  const [topic, setTopic] = useState<TopicKey | "all">("all");
  const [freeOnly, setFreeOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [q, setQ] = useState("");
  const [day, setDay] = useState<string | null>(null);

  const clashMap = useMemo(() => new Map(events.map((e) => [e.id, clashesFor(e, blocks)])), [events, blocks]);

  if (now === null) return <div className="micro">Loading…</div>;
  const today = londonDate(now);

  // Everything except the "when" and day filters, so the density map shows the shape of
  // what the other filters leave.
  const base = events.filter((e) => {
    if (e.end < now) return false;
    if (where === "in-person" && e.online) return false;
    if (where === "online" && !e.online) return false;
    if (topic !== "all" && !e.topics.includes(topic)) return false;
    if (freeOnly && e.price === "paid") return false;
    if (savedOnly && !marks[e.id]) return false;
    if (q && !`${e.title} ${e.host} ${e.venue}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const weekEnd = wallToInstant(addDays(mondayOf(today), 7), "00:00");
  const [y, m] = today.split("-").map(Number);
  const monthEnd = wallToInstant(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, "00:00");
  const limit = when === "week" ? weekEnd : when === "month" ? monthEnd : Infinity;
  const visible = base.filter((e) => e.start < limit && (!day || londonDate(e.start) === day));

  const counts = new Map<string, number>();
  const clashDays = new Set<string>();
  for (const e of base) {
    const d = londonDate(e.start);
    counts.set(d, (counts.get(d) ?? 0) + 1);
    if (clashMap.get(e.id)?.length) clashDays.add(d);
  }

  const failed = feeds.filter((f) => !f.ok);
  const going = events.filter((e) => marks[e.id] === "going" && e.end >= now).length;

  if (!configured)
    return (
      <Panel label="NO CALENDARS YET" accent="violet" className="max-w-2xl">
        <div className="space-y-3 text-sm text-muted">
          <p>
            This page reads public Luma calendars through the iCal feed Luma publishes for each one. It doesn’t log in or scrape
            anything, and it ships with no calendars because only you know which communities you follow.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open a Luma calendar you like (a London AI meetup series, a hackathon organiser, a crypto community).</li>
            <li>Click <span className="text-text">Add iCal Subscription</span> in its sidebar and copy the <code>api.lu.ma/ics/get?…</code> link.</li>
            <li>Paste it in <Link href="/settings" className="text-teal underline decoration-dotted">Settings → Tech events</Link>, one per line, as <code>Name | link</code>.</li>
          </ol>
          <p>Any other public .ics link works too.</p>
        </div>
      </Panel>
    );

  return (
    <div className="space-y-4">
      {(failed.length > 0 || problems.length > 0) && (
        <div className="space-y-1 rounded-sm border border-magenta/40 p-3 text-xs">
          {problems.map((p) => <div key={p} className="text-magenta">{p}</div>)}
          {failed.map((f) => (
            <div key={f.url} className="text-magenta">
              {f.label}: {f.error}
              {f.stale && ` Showing the last copy${f.fetchedAt ? ` from ${new Date(f.fetchedAt).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}.`}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Seg value={when} set={setWhen} options={[["all", "Upcoming"], ["week", "This week"], ["month", "This month"]]} />
        <Seg value={where} set={setWhere} options={[["all", "Any"], ["in-person", "In person"], ["online", "Online"]]} />
        <label className="micro flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} className="accent-[#2ee6d6]" />
          Free only
        </label>
        <label className="micro flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} className="accent-[#2ee6d6]" />
          Going / interested ({Object.keys(marks).length})
        </label>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="field sm:ml-auto sm:!w-44" />
      </div>

      <div className="flex flex-wrap gap-2">
        {([{ key: "all", label: "All topics" }, ...TOPICS] as { key: TopicKey | "all"; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTopic(t.key)}
            className={`micro rounded-sm border px-2.5 py-1.5 transition-colors ${topic === t.key ? "border-violet/70 bg-violet/15 text-text" : "border-line hover:border-violet/40"}`}
          >
            {t.label}
            <span className="ml-1 text-teal">{(t.key === "all" ? base : base.filter((e) => e.topics.includes(t.key as TopicKey))).length}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="order-2 space-y-3 xl:order-1">
          <div className="micro flex flex-wrap items-center gap-x-3">
            <span>{visible.length} event{visible.length === 1 ? "" : "s"}</span>
            {going > 0 && <span className="text-teal">{going} going</span>}
            {day && (
              <button onClick={() => setDay(null)} className="underline decoration-dotted hover:text-teal">clear day filter</button>
            )}
          </div>
          {visible.length === 0 ? (
            <Panel label="NOTHING MATCHES">
              <p className="text-sm text-muted">
                {events.length === 0
                  ? "The feeds returned no upcoming events."
                  : "No upcoming events match these filters. Try widening them."}
              </p>
            </Panel>
          ) : (
            <ul className="space-y-3">
              {visible.slice(0, 80).map((e, i) => (
                <EventCard key={e.id} e={e} index={i} clashes={clashMap.get(e.id) ?? []} mark={marks[e.id]} onMark={(mk) => toggle(e.id, mk)} />
              ))}
            </ul>
          )}
          {visible.length > 80 && <div className="micro">Showing the first 80. Narrow the filters to see the rest.</div>}
          <p className="micro normal-case tracking-wide !text-[10px]">
            Topic and price are guessed from each event’s title and short description, so treat them as hints. “Free only” hides
            events whose text mentions a price; events that say nothing about price stay in.
          </p>
        </div>

        <div className="order-1 space-y-4 xl:order-2">
          <Panel label="EVENT DENSITY // NEXT 10 WEEKS" accent="violet">
            <DensityMap today={today} counts={counts} clashDays={clashDays} selected={day} onSelect={setDay} />
          </Panel>
          <Panel label="FEEDS">
            <ul className="space-y-1.5 text-xs">
              {feeds.map((f) => (
                <li key={f.url} className="flex items-center justify-between gap-2">
                  <span className="truncate">{f.label}</span>
                  <span className={f.ok ? "text-muted" : "text-magenta"}>{f.ok ? `${f.count} listed` : f.stale ? "stale" : "failed"}</span>
                </li>
              ))}
            </ul>
            <p className="micro mt-2 normal-case tracking-wide !text-[10px]">
              Refreshed at most hourly. <Link href="/settings" className="text-teal underline decoration-dotted">Edit feeds</Link>
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
