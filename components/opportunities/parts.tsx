"use client";

import type { MatchResult } from "@/lib/match";
import type { Timing } from "@/lib/opp";

export function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? "#2ee6d6" : score >= 50 ? "#7c5cff" : "#7d9392";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`CV match ${score}/100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-[11px]" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

export function TimingBadges({ t }: { t: Timing }) {
  const tone =
    t.state === "closed"
      ? "border-white/10 text-muted"
      : t.state === "opens_soon"
        ? "border-violet/50 text-violet"
        : "border-teal/50 text-teal";
  return (
    <div className="flex flex-wrap gap-1">
      <span className={`micro rounded-sm border px-1.5 py-0.5 !text-[9px] ${tone}`}>{t.stateLabel}</span>
      {t.countdown && (
        <span
          className={`micro rounded-sm border px-1.5 py-0.5 !text-[9px] ${t.urgent ? "border-magenta/60 text-magenta" : "border-white/10 text-muted"}`}
        >
          {t.countdown}
        </span>
      )}
    </div>
  );
}

export function MatchBreakdown({ m }: { m: MatchResult }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <ScoreRing score={m.score} size={52} />
        <div>
          <div className="micro">CV match</div>
          <div className="text-sm">{m.why}</div>
        </div>
      </div>
      {m.groups.map((g) => (
        <div key={g.key}>
          <div className="mb-1 flex justify-between">
            <span className="micro">{g.label}</span>
            <span className="micro">weight {g.weight}/10</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <div className="flow-gradient h-full" style={{ width: `${g.points}%` }} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {g.hits.map((h) => (
              <span key={h} className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-[10px] text-text/80">
                {h}
              </span>
            ))}
          </div>
        </div>
      ))}
      {m.adjustments.length > 0 && (
        <ul className="space-y-1 border-t border-line pt-2">
          {m.adjustments.map((a) => (
            <li key={a.text} className="flex justify-between text-xs text-muted">
              <span>{a.text}</span>
              <span className={a.delta > 0 ? "text-teal" : "text-magenta"}>{a.delta > 0 ? "+" : ""}{a.delta}</span>
            </li>
          ))}
        </ul>
      )}
      {m.groups.length === 0 && <p className="text-xs text-muted">Nothing in this listing matches your CV keywords. Tune them in Settings.</p>}
    </div>
  );
}
