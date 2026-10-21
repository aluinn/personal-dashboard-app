"use client";

import { motion } from "framer-motion";
import { CalendarPlus, Check, ExternalLink, MapPin, Star, TriangleAlert, Video } from "lucide-react";
import { eventFileName, eventIcs } from "@/lib/events/event-ics";
import type { Mark } from "@/lib/events/marks";
import { TOPICS, type Block, type TechEvent } from "@/lib/events/types";
import { distanceLabel, fmtDayLong, fmtDayNum, fmtMonth, fmtTime } from "./format";

function download(e: TechEvent) {
  const url = URL.createObjectURL(new Blob([eventIcs(e)], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = eventFileName(e);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const Tag = ({ children, tone = "" }: { children: React.ReactNode; tone?: string }) => (
  <span className={`micro rounded-sm border border-line px-1.5 py-0.5 !text-[9px] ${tone}`}>{children}</span>
);

export default function EventCard({
  e,
  clashes,
  mark,
  onMark,
  index,
}: {
  e: TechEvent;
  clashes: Block[];
  mark?: Mark;
  onMark: (m: Mark) => void;
  index: number;
}) {
  const safeUrl = /^https?:\/\//i.test(e.url) ? e.url : "";
  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.03 }}
      className={`bg-[var(--panel)] relative flex gap-3 rounded-sm border p-3 sm:gap-4 ${clashes.length ? "border-magenta/50" : mark === "going" ? "border-teal/60" : "border-line"}`}
    >
      <div className="w-11 shrink-0 text-center sm:w-12">
        <div className="micro !text-[9px] text-teal">{fmtMonth(e.start)}</div>
        <div className="font-mono text-xl leading-none">{fmtDayNum(e.start)}</div>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="text-sm leading-snug">{e.title}</div>
        <div className="micro normal-case tracking-wide">
          {fmtDayLong(e.start)}
          {!e.allDay && ` · ${fmtTime(e.start)}–${fmtTime(e.end)}`}
          {e.host && <> · Hosted by <span className="text-text/90">{e.host}</span></>}
        </div>
        <div className="flex items-start gap-1.5 text-xs text-muted">
          {e.online ? <Video className="mt-0.5 h-3 w-3 shrink-0" /> : <MapPin className="mt-0.5 h-3 w-3 shrink-0" />}
          <span className="min-w-0">
            {e.online ? "Online" : e.venue}
            {!e.online && e.km !== null && <span className="text-teal/80"> · {distanceLabel(e.km)}</span>}
          </span>
        </div>

        {clashes.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-magenta">
            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
            <span>Clashes with {clashes.map((c) => `${c.code} ${fmtTime(c.start)}–${fmtTime(c.end)}`).join(", ")}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {e.topics.map((t) => (
            <Tag key={t} tone="!text-violet">{TOPICS.find((x) => x.key === t)?.label}</Tag>
          ))}
          <Tag>{e.online ? "online" : "in person"}</Tag>
          {e.price === "free" && <Tag tone="!text-teal">free</Tag>}
          {e.price === "paid" && <Tag tone="!text-[#c4811a]">paid</Tag>}
          <Tag>{e.source}</Tag>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1.5">
          <button
            onClick={() => onMark("going")}
            aria-pressed={mark === "going"}
            className={`btn inline-flex items-center gap-1 ${mark === "going" ? "bg-teal/20" : "!border-line !text-muted"}`}
          >
            <Check className="h-3 w-3" /> Going
          </button>
          <button
            onClick={() => onMark("interested")}
            aria-pressed={mark === "interested"}
            className={`btn inline-flex items-center gap-1 ${mark === "interested" ? "!border-violet/70 !text-violet bg-violet/15" : "!border-line !text-muted"}`}
          >
            <Star className="h-3 w-3" /> Interested
          </button>
          <button onClick={() => download(e)} className="btn inline-flex items-center gap-1 !border-line !text-muted hover:!text-teal">
            <CalendarPlus className="h-3 w-3" /> Add to calendar
          </button>
          {safeUrl && (
            <a href={safeUrl} target="_blank" rel="noreferrer" className="btn ml-auto inline-flex items-center gap-1">
              RSVP <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </motion.li>
  );
}
