"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { addDays, DAY_NAMES, formatDay, mondayOf } from "@/lib/time";

// Ten weeks from this Monday. One hue (teal), darker = more events; a magenta dot marks a
// day with an event that clashes with the timetable.
const WEEKS = 10;
const OPACITY = [0, 0.22, 0.42, 0.68, 0.95];

export default function DensityMap({
  today,
  counts,
  clashDays,
  selected,
  onSelect,
}: {
  today: string;
  counts: Map<string, number>;
  clashDays: Set<string>;
  selected: string | null;
  onSelect: (d: string | null) => void;
}) {
  const start = mondayOf(today);
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(start, i));
  const [hover, setHover] = useState<string | null>(null);
  const shown = hover ?? selected;
  const n = shown ? (counts.get(shown) ?? 0) : 0;

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-[3px]">
        {DAY_NAMES.map((d) => (
          <div key={d} className="micro text-center !text-[9px]">{d[0]}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[3px]" onMouseLeave={() => setHover(null)}>
        {days.map((d, i) => {
          const c = counts.get(d) ?? 0;
          const level = Math.min(4, c);
          const past = d < today;
          const first = d.endsWith("-01");
          return (
            <motion.button
              key={d}
              type="button"
              onClick={() => onSelect(selected === d ? null : d)}
              onMouseEnter={() => setHover(d)}
              onFocus={() => setHover(d)}
              onBlur={() => setHover(null)}
              aria-label={`${formatDay(d)}: ${c} event${c === 1 ? "" : "s"}${clashDays.has(d) ? ", clashes with timetable" : ""}`}
              aria-pressed={selected === d}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: past ? 0.45 : 1, scale: 1 }}
              transition={{ delay: i * 0.01, type: "spring", stiffness: 260, damping: 22 }}
              whileHover={{ scale: 1.15 }}
              className={`relative aspect-square rounded-[3px] border text-[9px] ${d === today ? "border-teal" : selected === d ? "border-violet" : "border-line"}`}
              style={{
                background: `rgba(46,230,214,${OPACITY[level]})`,
                boxShadow: level >= 3 ? "0 0 10px -2px rgba(46,230,214,0.7)" : undefined,
              }}
            >
              <span className={`absolute left-[3px] top-[1px] font-mono ${level >= 3 ? "text-[#05080a]" : "text-muted"}`}>
                {first ? formatDay(d, { month: "short" }).toUpperCase().slice(0, 3) : Number(d.slice(8))}
              </span>
              {clashDays.has(d) && <span className="absolute bottom-[3px] right-[3px] h-1.5 w-1.5 rounded-full bg-magenta ring-1 ring-[#05080a]" />}
            </motion.button>
          );
        })}
      </div>
      <div className="mt-3 flex min-h-8 items-center justify-between gap-2">
        <div className="micro normal-case tracking-wide" aria-live="polite">
          {shown ? (
            <>
              <span className="text-text">{formatDay(shown)}</span> · {n} event{n === 1 ? "" : "s"}
              {clashDays.has(shown) && <span className="text-magenta"> · clash</span>}
            </>
          ) : (
            "Hover a day. Click to filter the list."
          )}
        </div>
        <div className="flex items-center gap-1" aria-hidden>
          <span className="micro !text-[9px]">0</span>
          {OPACITY.map((o) => (
            <span key={o} className="h-2.5 w-2.5 rounded-[2px] border border-line" style={{ background: `rgba(46,230,214,${o})` }} />
          ))}
          <span className="micro !text-[9px]">4+</span>
        </div>
      </div>
    </div>
  );
}
