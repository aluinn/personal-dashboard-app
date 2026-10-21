"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import CountUp from "@/components/ui/CountUp";

export default function GoalRing({ value, target }: { value: number; target: number }) {
  const reduce = useReducedMotion();
  const R = 54;
  const C = 2 * Math.PI * R;
  const frac = Math.min(1, value / Math.max(1, target));
  const done = value >= target;
  return (
    <div className="flex flex-col items-center">
      <div className={`relative h-[148px] w-[148px] rounded-full ${done ? "pulse-accent" : ""}`} style={{ ["--c" as string]: "#2ee6d6" }} role="img" aria-label={`${value} of ${target} workouts this week`}>
        <svg viewBox="0 0 140 140" className="-rotate-90">
          <defs>
            <linearGradient id="goalGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7c5cff" />
              <stop offset="100%" stopColor="#2ee6d6" />
            </linearGradient>
          </defs>
          <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
          <motion.circle
            key={`${value}-${target}`}
            cx="70" cy="70" r={R} fill="none" stroke="url(#goalGrad)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C}
            initial={{ strokeDashoffset: reduce ? C * (1 - frac) : C }}
            animate={{ strokeDashoffset: C * (1 - frac) }}
            transition={{ duration: reduce ? 0 : 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="font-mono text-4xl font-light text-teal glow-text">
              <CountUp to={value} />
              <span className="text-xl text-muted">/{target}</span>
            </div>
            <div className="micro flex items-center justify-center gap-1">
              {done ? (<><Check className="h-3 w-3 text-teal" /> goal hit</>) : "this week"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
