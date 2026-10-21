"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Panel from "@/components/ui/Panel";
import GalaxyLoader from "@/components/galaxy/GalaxyLoader";
import { buildGraph } from "@/lib/galaxy";
import type { ModuleSummary, NoteItem } from "@/lib/notes";
import { useNow } from "@/lib/useNow";

const noop = () => {};
const ago = (ms: number | null, now: number) => {
  if (ms === null) return "—";
  const d = Math.floor((now - ms) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
};

/** Smaller galaxy for Home. It idles with a slow spin and only becomes draggable once you hover (or tap) it. */
export default function GalaxyWidget({ modules, notes }: { modules: ModuleSummary[]; notes: NoteItem[] }) {
  const now = useNow(60_000);
  const graph = useMemo(() => buildGraph(notes, modules, now ?? 0), [notes, modules, now]);
  const [live, setLive] = useState(false);
  const real = notes.filter((n) => !n.placeholder);
  const words = real.reduce((a, n) => a + n.words, 0);
  const allPh = real.length === 0;

  return (
    <Panel label="KNOWLEDGE GALAXY" meta={<Link href="/notes" className="hover:text-teal">Open →</Link>} accent="violet" delay={0.5} className="md:col-span-6 xl:col-span-12">
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div
          className="relative h-72 overflow-hidden rounded-sm border border-line sm:h-80"
          onPointerEnter={() => setLive(true)}
          onPointerLeave={() => setLive(false)}
        >
          {now !== null && (
            <GalaxyLoader
              graph={graph} layout="clusters" selectedId={null} isolate={null} matchIds={null} interactive={live} compact resetSignal={0}
              onHover={noop} onSelect={noop} onIsolate={noop} onHit={noop}
            />
          )}
          {!live && <div className="micro pointer-events-none absolute bottom-2 right-3 !text-[9px]">Hover to explore</div>}
        </div>
        <div>
          <div className="grid grid-cols-2 gap-3">
            <div><div className="micro">Notes</div><div className="font-mono text-3xl font-light text-teal glow-text">{real.length}</div>{allPh && <div className="micro normal-case tracking-wide !text-[9px]">{notes.length} placeholders</div>}</div>
            <div><div className="micro">Words written</div><div className="font-mono text-3xl font-light text-teal glow-text">{words.toLocaleString("en-GB")}</div></div>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {modules.map((m) => (
              <li key={m.code} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }} />
                  <span className="truncate font-mono text-xs" style={{ color: m.color }}>{m.code}</span>
                </span>
                <span className="micro shrink-0 normal-case tracking-wide">
                  {m.placeholder ? "placeholder" : `${m.noteCount} notes · studied ${now ? ago(m.lastEdited, now) : "…"}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="micro mt-2 normal-case tracking-wide !text-[10px]">“Last studied” = when you last edited a note in that module.</p>
        </div>
      </div>
    </Panel>
  );
}
