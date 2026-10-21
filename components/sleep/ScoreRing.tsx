"use client";

import { motion, useReducedMotion } from "framer-motion";
import CountUp from "@/components/ui/CountUp";

export default function ScoreRing({ score, label, sub }: { score: number | null; label: string; sub?: string }) {
  const reduce = useReducedMotion();
  const R = 62;
  const C = 2 * Math.PI * R;
  const v = score ?? 0;
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[168px] w-[168px]" role="img" aria-label={score === null ? "No sleep score yet" : `Sleep score ${score} out of 100`}>
        <svg viewBox="0 0 160 160" className="-rotate-90">
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7c5cff" />
              <stop offset="100%" stopColor="#2ee6d6" />
            </linearGradient>
          </defs>
          <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
          <motion.circle
            key={score}
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: reduce ? C * (1 - v / 100) : C }}
            animate={{ strokeDashoffset: C * (1 - v / 100) }}
            transition={{ duration: reduce ? 0 : 1.3, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="font-mono text-5xl font-light text-teal glow-text">{score === null ? "–" : <CountUp to={score} />}</div>
            <div className="micro -mt-0.5">/ 100</div>
          </div>
        </div>
      </div>
      <div className="micro mt-2 text-text">{label}</div>
      {sub && <div className="micro mt-0.5 normal-case tracking-wide">{sub}</div>}
    </div>
  );
}
