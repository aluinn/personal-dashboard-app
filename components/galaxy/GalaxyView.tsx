"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, RotateCcw, X } from "lucide-react";
import Panel from "@/components/ui/Panel";
import { buildGraph, matches, type Layout } from "@/lib/galaxy";
import type { ModuleSummary, NoteItem } from "@/lib/notes";
import { useNow } from "@/lib/useNow";
import GalaxyLoader, { type Mode } from "./GalaxyLoader";

const LAYOUTS: [Layout, string][] = [["clusters", "Clusters"], ["timeline", "Timeline"], ["concepts", "Concept map"]];
const ago = (ms: number | null, now: number) => {
  if (ms === null) return "placeholder (no edit date)";
  const d = Math.floor((now - ms) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

export default function GalaxyView({
  notes, modules, query, onQuery,
}: { notes: NoteItem[]; modules: ModuleSummary[]; query: string; onQuery: (q: string) => void }) {
  const now = useNow(60_000);
  const graph = useMemo(() => buildGraph(notes, modules, now ?? 0), [notes, modules, now]);
  const [layout, setLayout] = useState<Layout>("clusters");
  const [mode, setMode] = useState<Mode>("auto");
  const [selected, setSelected] = useState<string | null>(null);
  const [isolate, setIsolate] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [reset, setReset] = useState(0);
  const lastHit = useRef(0);
  const tap = useRef({ t: 0, x: 0, y: 0, dx: 0, dy: 0 });

  const matchIds = useMemo(() => (query.trim() ? new Set(graph.nodes.filter((n) => matches(n, query)).map((n) => n.id)) : null), [graph, query]);
  const sel = graph.nodes.find((n) => n.id === selected) ?? null;
  const hov = hover ? graph.nodes.find((n) => n.id === hover.id) : null;
  const doReset = () => {
    setSelected(null);
    setIsolate(null);
    setReset((r) => r + 1);
  };

  if (now === null) return <Panel label="KNOWLEDGE GALAXY" accent="violet"><div className="micro">Loading…</div></Panel>;

  return (
    <Panel
      label="KNOWLEDGE GALAXY"
      meta={`${graph.nodes.length} NOTES${notes.every((n) => n.placeholder) ? " · PLACEHOLDERS" : ""}`}
      accent="violet"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Layout">
          {LAYOUTS.map(([k, label]) => (
            <button key={k} onClick={() => { setLayout(k); setSelected(null); setReset((r) => r + 1); }} aria-pressed={layout === k} disabled={mode === "2d"} className={`btn ${layout === k && mode !== "2d" ? "bg-teal/15" : "!border-line !text-muted"}`}>{label}</button>
          ))}
        </div>
        <div className="flex gap-1" role="group" aria-label="Renderer">
          {(["auto", "3d", "2d"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={`btn ${mode === m ? "bg-violet/20" : "!border-line !text-muted"}`}>{m === "auto" ? "Auto" : m.toUpperCase()}</button>
          ))}
        </div>
        <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search: matching notes glow…" aria-label="Search notes" className="field sm:ml-auto sm:!w-64" />
        <button className="btn inline-flex items-center gap-1 !border-line !text-muted hover:!text-teal" onClick={doReset} title="Reset the view (or double-click empty space)">
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      {isolate && (
        <button onClick={() => setIsolate(null)} className="micro mb-2 inline-flex items-center gap-1 rounded-sm border border-violet/50 px-2 py-1 text-violet">
          Isolated: {isolate} <X className="h-3 w-3" />
        </button>
      )}

      <div
        className="relative h-[460px] overflow-hidden rounded-sm border border-line bg-[radial-gradient(ellipse_at_center,rgba(124,92,255,0.08),transparent_70%)] sm:h-[560px]"
        onPointerDown={(e) => { tap.current.dx = e.clientX; tap.current.dy = e.clientY; }}
        onPointerUp={(e) => {
          // Double-tap on empty space resets. Done by hand because the orbit controls capture the pointer
          // and the browser's own dblclick doesn't reliably fire on the canvas.
          const t = tap.current, now2 = performance.now();
          const dragged = Math.hypot(e.clientX - t.dx, e.clientY - t.dy) > 6;
          if (dragged) { t.t = 0; return; }
          if (now2 - t.t < 350 && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 24 && now2 - lastHit.current > 400) { t.t = 0; doReset(); return; }
          t.t = now2; t.x = e.clientX; t.y = e.clientY;
        }}
      >
        <GalaxyLoader
          graph={graph} layout={layout} mode={mode} selectedId={selected} isolate={isolate} matchIds={matchIds}
          interactive resetSignal={reset}
          onHover={(id, x, y) => setHover(id ? { id, x, y } : null)}
          onSelect={(id) => { lastHit.current = performance.now(); setSelected(id); }}
          onIsolate={(c) => { lastHit.current = performance.now(); setIsolate((cur) => (cur === c ? null : c)); }}
          onHit={() => { lastHit.current = performance.now(); }}
        />

        {hov && hover && (
          <div
            className="pointer-events-none fixed z-30 max-w-64 rounded-sm border border-line bg-[#0a1115]/95 px-2.5 py-2 text-xs shadow-lg"
            style={{ left: Math.min(hover.x + 14, window.innerWidth - 270), top: hover.y + 14 }}
          >
            <div className="text-sm text-text">{hov.title}</div>
            <div className="micro normal-case tracking-wide" style={{ color: graph.modules[hov.mi].color }}>{hov.module} · {graph.modules[hov.mi].name}</div>
            <div className="micro normal-case tracking-wide">Edited {ago(hov.editedAt, now)}{hov.placeholder ? " · placeholder" : ""}</div>
          </div>
        )}

        <AnimatePresence>
          {sel && (
            <motion.aside
              initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
              aria-label="Note preview"
              className="absolute inset-x-2 bottom-2 z-20 max-h-[55%] overflow-auto rounded-sm border border-teal/40 bg-[#0a1115]/95 p-3 backdrop-blur sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:max-h-[calc(100%-1.5rem)] sm:w-72"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="micro" style={{ color: graph.modules[sel.mi].color }}>{sel.module}</div>
                <button onClick={() => setSelected(null)} aria-label="Close preview" className="text-muted hover:text-text"><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mt-1 text-sm">{sel.title}</div>
              {sel.placeholder && <span className="micro mt-1 inline-block rounded-sm border border-line px-1.5 py-0.5 !text-[9px]">placeholder</span>}
              <div className="micro mt-2 normal-case tracking-wide">Edited {ago(sel.editedAt, now)} · {sel.words} words{sel.week ? ` · week ${sel.week}` : ""}</div>
              {sel.preview && <p className="mt-2 text-xs text-muted">{sel.preview}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {sel.tags.map((t) => (
                  <button key={t} onClick={() => onQuery(t)} className="micro rounded-sm border border-line px-1.5 py-0.5 !text-[9px] hover:border-teal/50 hover:text-teal">{t}</button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Link href={`/notes/${sel.id}`} className="btn">Read here</Link>
                {sel.url ? (
                  <a href={sel.url} target="_blank" rel="noreferrer" className="btn inline-flex items-center gap-1">Open PDF <ExternalLink className="h-3 w-3" /></a>
                ) : (
                  <span className="micro self-center !text-[9px]">No PDF yet</span>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <div className="micro mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 normal-case tracking-wide !text-[10px]">
        {graph.modules.map((m) => (
          <button key={m.code} onClick={() => setIsolate((c) => (c === m.code ? null : m.code))} className="inline-flex items-center gap-1.5 hover:text-text" aria-pressed={isolate === m.code}>
            <span className="h-2 w-2 rounded-full" style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }} />{m.code}
          </button>
        ))}
        <span>Size = note length · brightness = recently edited · lines = shared tags · drag to orbit, scroll to zoom, click a node, click a core to isolate, double-click empty space to reset</span>
      </div>
    </Panel>
  );
}
