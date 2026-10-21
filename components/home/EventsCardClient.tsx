"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import Panel from "@/components/ui/Panel";
import { fmtDayLong, fmtTime } from "@/components/events/format";
import { clashesFor } from "@/lib/events/clash";
import { useEventMarks } from "@/lib/events/marks";
import type { Block } from "@/lib/events/types";
import { useNow } from "@/lib/useNow";

type Slim = { id: string; title: string; start: number; end: number; allDay: boolean; online: boolean; venue: string };

export default function EventsCardClient({ events, blocks }: { events: Slim[]; blocks: Block[] }) {
  const now = useNow(60000);
  const { marks } = useEventMarks();
  const upcoming = events.filter((e) => now !== null && e.end >= now);
  const marked = upcoming.filter((e) => marks[e.id]);
  // Your Going / Interested events first, then the next unmarked ones to fill the card.
  const picks = [...marked, ...upcoming.filter((e) => !marks[e.id])].slice(0, 3).sort((a, b) => a.start - b.start);

  return (
    <Panel
      label="NEXT 3 // TECH EVENTS"
      meta={<Link href="/events" className="hover:text-teal">View all →</Link>}
      delay={0.4}
      className="md:col-span-6 xl:col-span-4"
    >
      {now === null ? (
        <div className="micro">Loading…</div>
      ) : picks.length === 0 ? (
        <p className="text-sm text-muted">No upcoming events in your calendars.</p>
      ) : (
        <ul className="divide-y divide-line">
          {picks.map((e) => {
            const clash = clashesFor(e, blocks);
            return (
              <li key={e.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate text-sm">{e.title}</div>
                  {marks[e.id] && (
                    <span className={`micro shrink-0 !text-[9px] ${marks[e.id] === "going" ? "!text-teal" : "!text-violet"}`}>
                      {marks[e.id]}
                    </span>
                  )}
                </div>
                <div className="micro truncate normal-case tracking-wide">
                  {fmtDayLong(e.start)}{!e.allDay && ` · ${fmtTime(e.start)}`} · {e.online ? "Online" : e.venue.split(",")[0]}
                </div>
                {clash.length > 0 && (
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-magenta">
                    <TriangleAlert className="h-3 w-3" /> Clashes with {clash[0].code}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {marked.length === 0 && picks.length > 0 && (
        <p className="micro mt-3 normal-case tracking-wide !text-[10px]">Mark events Going or Interested to pin them here.</p>
      )}
    </Panel>
  );
}
