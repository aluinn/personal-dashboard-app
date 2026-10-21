"use client";

import { motion } from "framer-motion";
import type { Module } from "@/lib/db/types";
import { sessionLabel, type Occurrence } from "@/lib/schedule";
import { DAY_NAMES, addDays, formatDay, londonDate, londonMinutes, toMinutes } from "@/lib/time";

const HOUR_PX = 52;

// Place overlapping events side by side.
function layout(items: Occurrence[]) {
  const sorted = [...items].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  const lanesEnd: number[] = [];
  const placed = sorted.map((o) => {
    const s = toMinutes(o.startTime);
    let lane = lanesEnd.findIndex((end) => end <= s);
    if (lane === -1) lane = lanesEnd.length;
    lanesEnd[lane] = Math.max(toMinutes(o.endTime), s + 30);
    return { o, lane };
  });
  return placed.map((p) => ({ ...p, lanes: lanesEnd.length }));
}

export default function WeekGrid({
  weekStart,
  occ,
  mods,
  now,
  liveKey,
}: {
  weekStart: string;
  occ: Occurrence[];
  mods: Map<number, Module>;
  now: number;
  liveKey?: string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = londonDate(now);

  const startHour = Math.min(8, ...occ.map((o) => Math.floor(toMinutes(o.startTime) / 60)));
  const endHour = Math.max(19, ...occ.map((o) => Math.ceil(toMinutes(o.endTime) / 60)));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const height = hours.length * HOUR_PX;

  const nowMin = londonMinutes(now);
  const nowTop = ((nowMin - startHour * 60) / 60) * HOUR_PX;
  const showNow = days.includes(today) && nowTop >= 0 && nowTop <= height;
  const nowLabel = new Date(now).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        {/* Day headers */}
        <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-line">
          <div />
          {days.map((d, i) => (
            <div key={d} className={`px-2 pb-2 text-center ${d === today ? "text-teal" : "text-muted"}`}>
              <div className="micro text-inherit">{DAY_NAMES[i]}</div>
              <div className="font-mono text-sm">{formatDay(d, { day: "numeric", month: "short" })}</div>
            </div>
          ))}
        </div>

        <div className="relative grid grid-cols-[48px_repeat(7,1fr)]" style={{ height }}>
          {/* hour gutter */}
          <div className="relative">
            {hours.map((h) => (
              <div
                key={h}
                className={`micro absolute right-2 -translate-y-1/2 ${showNow && Math.abs((h - startHour) * HOUR_PX - nowTop) < 16 ? "invisible" : ""}`}
                style={{ top: (h - startHour) * HOUR_PX }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {days.map((d) => (
            <div key={d} className={`relative border-l border-line ${d === today ? "bg-teal/[0.03]" : ""}`}>
              {hours.map((h) => (
                <div key={h} className="absolute inset-x-0 border-t border-white/[0.04]" style={{ top: (h - startHour) * HOUR_PX }} />
              ))}
              {layout(occ.filter((o) => o.date === d)).map(({ o, lane, lanes }) => {
                const { code, color } = sessionLabel(o, mods);
                const top = ((toMinutes(o.startTime) - startHour * 60) / 60) * HOUR_PX;
                const h = Math.max(24, ((toMinutes(o.endTime) - toMinutes(o.startTime)) / 60) * HOUR_PX);
                return (
                  <div
                    key={o.key}
                    title={`${o.title}\n${o.startTime}–${o.endTime}`}
                    style={
                      {
                        "--c": color,
                        top,
                        height: h - 2,
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                        background: `color-mix(in srgb, ${color} 16%, transparent)`,
                        borderLeft: `2px solid ${color}`,
                      } as React.CSSProperties
                    }
                    className={`absolute overflow-hidden rounded-[2px] px-1.5 py-1 ${o.key === liveKey ? "pulse-accent" : ""}`}
                  >
                    <div className="font-mono text-[10px] tracking-wider" style={{ color }}>
                      {code} · {o.startTime}
                    </div>
                    {h > 40 && <div className="text-[11px] leading-tight text-text/90">{o.title.replace(/^HPSC\d+\s/, "")}</div>}
                    {h > 70 && (o.room || o.location) && (
                      <div className="micro mt-0.5 normal-case tracking-normal">{[o.room, o.location].filter(Boolean).join(" · ")}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* animated "now" line */}
          {showNow && (
            <motion.div
              className="pointer-events-none absolute inset-x-0 z-10"
              initial={false}
              animate={{ top: nowTop }}
              transition={{ type: "spring", stiffness: 60, damping: 18 }}
            >
              <div className="absolute -left-0 w-[44px] -translate-y-1/2 text-right font-mono text-[10px] text-teal glow-text">{nowLabel}</div>
              <div className="absolute left-[48px] right-0 h-px -translate-y-1/2 bg-gradient-to-r from-teal via-teal/60 to-transparent shadow-[0_0_8px_rgba(46,230,214,0.8)]" />
              <span className="absolute left-[45px] h-[7px] w-[7px] -translate-y-1/2 rounded-full bg-teal">
                <span className="ping absolute inset-0 rounded-full bg-teal" />
              </span>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
