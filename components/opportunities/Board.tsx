"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { PIPELINE, STATUS_COLOR, timing } from "@/lib/opp";
import type { Scored } from "./OpportunitiesApp";
import { ScoreRing, TimingBadges } from "./parts";

const TYPE_COLOR: Record<string, string> = { finance: "#2ee6d6", tech: "#7c5cff", other: "#7d9392" };

export function OppCard({
  o,
  today,
  onOpen,
  onMove,
  draggable = true,
}: {
  o: Scored;
  today: string;
  onOpen: () => void;
  onMove?: (status: string) => void;
  draggable?: boolean;
}) {
  const t = timing(o, today);
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(o.id))}
      onClick={onOpen}
      style={{ borderLeft: `2px solid ${TYPE_COLOR[o.type] ?? TYPE_COLOR.other}` }}
      className={`cursor-pointer space-y-2 rounded-[2px] bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06] ${t.state === "closed" && o.status === "saved" ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{o.firm}</div>
          <div className="line-clamp-2 text-xs text-text/80">{o.role}</div>
        </div>
        <ScoreRing score={o.match.score} size={36} />
      </div>
      <div className="flex flex-wrap gap-1">
        <span className="micro rounded-sm bg-white/5 px-1.5 py-0.5 !text-[9px]">{o.type}</span>
        {o.programme !== "other" && <span className="micro rounded-sm bg-white/5 px-1.5 py-0.5 !text-[9px]">{o.programme}</span>}
      </div>
      <TimingBadges t={t} />
      <div className="truncate text-[11px] text-muted">{o.match.why}</div>
      <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        {o.link ? (
          <a href={o.link} target="_blank" rel="noreferrer" aria-label="Open listing" className="text-muted hover:text-teal">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span />
        )}
        {onMove && (
          <select
            aria-label="Move to stage"
            value=""
            onChange={(e) => e.target.value && onMove(e.target.value)}
            className="micro cursor-pointer border border-line bg-transparent px-1 py-0.5 !text-[9px] outline-none"
          >
            <option value="">Move…</option>
            {PIPELINE.filter((p) => p.key !== o.status).map((p) => (
              <option key={p.key} value={p.key} className="bg-[#0a1115]">
                {p.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

export default function Board({
  items,
  today,
  onOpen,
  onMove,
}: {
  items: Scored[];
  today: string;
  onOpen: (o: Scored) => void;
  onMove: (id: number, status: string) => void;
}) {
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {PIPELINE.map((col) => {
        const list = items
          .filter((o) => o.status === col.key)
          .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || b.match.score - a.match.score);
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.key);
            }}
            onDragLeave={() => setOver((c) => (c === col.key ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = Number(e.dataTransfer.getData("text/plain"));
              if (id) onMove(id, col.key);
            }}
            className={`min-h-[320px] w-[250px] shrink-0 rounded-sm border bg-panel p-2 transition-colors ${over === col.key ? "border-teal/60 bg-teal/[0.05]" : "border-line"}`}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="micro flex items-center gap-2" style={{ color: STATUS_COLOR[col.key] }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[col.key] }} />
                {col.label}
              </span>
              <span className="micro">{list.length}</span>
            </div>
            <div className="space-y-2">
              {list.map((o) => (
                <OppCard key={o.id} o={o} today={today} onOpen={() => onOpen(o)} onMove={(s) => onMove(o.id, s)} />
              ))}
              {list.length === 0 && <div className="micro px-1 py-6 text-center opacity-50">Drop here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
