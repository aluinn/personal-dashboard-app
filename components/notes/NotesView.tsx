"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Panel from "@/components/ui/Panel";
import GalaxyView from "@/components/galaxy/GalaxyView";
import { matches } from "@/lib/galaxy";
import type { ModuleSummary, NoteItem } from "@/lib/notes";
import type { SyncResult } from "@/lib/notion/sync";
import { useNow } from "@/lib/useNow";
import SetupGuide from "./SetupGuide";
import SyncButton from "./SyncButton";

type Status = { tokenSet: boolean; database: string; hours: number; last: SyncResult | null };

const PH = <span className="micro rounded-sm border border-line px-1.5 py-0.5 !text-[9px]" title="Sample note, replaced once real pages sync from Notion">placeholder</span>;
const when = (ms: number | null, now: number) => {
  if (ms === null) return "no edit date";
  const d = Math.floor((now - ms) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 30 ? `${d}d ago` : new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
const daysTo = (date: string, today: string) => Math.round((Date.parse(date) - Date.parse(today)) / 86400000);

export default function NotesView({ modules, notes, status, today }: { modules: ModuleSummary[]; notes: NoteItem[]; status: Status; currentTerm: string; today: string }) {
  const now = useNow(60_000);
  const [q, setQ] = useState("");
  const [mod, setMod] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");
  const [term, setTerm] = useState<string>("all");

  const hasSource = Boolean(status.database) || modules.some((m) => m.notionUrl);
  const connected = status.tokenSet && hasSource;
  const color = new Map(modules.map((m) => [m.code, m.color]));
  const allTags = useMemo(() => {
    const c = new Map<string, number>();
    notes.forEach((n) => n.tags.forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
  }, [notes]);
  const terms = [...new Set(notes.map((n) => n.term).filter(Boolean))].sort();

  const list = notes
    .filter((n) => (mod === "all" || n.module === mod) && (tag === "all" || n.tags.includes(tag)) && (term === "all" || n.term === term) && matches(n, q))
    .sort((a, b) => (b.editedAt ?? 0) - (a.editedAt ?? 0) || (b.week ?? 0) - (a.week ?? 0));

  if (now === null) return <div className="micro">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`micro ${connected ? "!text-teal" : "!text-muted"}`}>
          ● {connected ? "Notion connected" : status.tokenSet ? "Token set, no source yet" : "Notion not connected"}
        </span>
        {status.last && (
          <span className={`micro normal-case tracking-wide ${status.last.ok ? "" : "!text-magenta"}`}>
            Last sync {when(status.last.at, now)}: {status.last.ok ? `${status.last.pages} pages` : status.last.error}
          </span>
        )}
        <div className="sm:ml-auto"><SyncButton disabled={!connected} /></div>
      </div>

      {!connected && <SetupGuide tokenSet={status.tokenSet} hasSource={hasSource} />}

      <GalaxyView notes={notes} modules={modules} query={q} onQuery={setQ} />

      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((m) => {
          const mine = notes.filter((n) => n.module === m.code).sort((a, b) => (b.editedAt ?? 0) - (a.editedAt ?? 0) || (b.week ?? 0) - (a.week ?? 0)).slice(0, 3);
          return (
            <Panel key={m.code} label={`${m.code} // ${m.name.toUpperCase()}`} color={m.color} meta={`YEAR ${m.year} · ${m.term.toUpperCase()}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{m.noteCount} note{m.noteCount === 1 ? "" : "s"}</span>
                {m.placeholder ? PH : <span>{m.words.toLocaleString("en-GB")} words</span>}
                <span>· last edited {m.placeholder ? "—" : when(m.lastEdited, now)}</span>
              </div>
              <div className="mt-3">
                <div className="micro flex justify-between"><span>Weeks covered</span><span className="text-text">{m.weeksCovered}/{m.termWeeks}{m.placeholder ? " (placeholder)" : ""}</span></div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full" style={{ width: `${Math.min(100, (m.weeksCovered / m.termWeeks) * 100)}%`, background: m.color, opacity: m.placeholder ? 0.4 : 1 }} />
                </div>
              </div>
              <ul className="mt-3 divide-y divide-line">
                {mine.map((n) => (
                  <li key={n.id} className="py-2 first:pt-0">
                    <Link href={`/notes/${n.id}`} className="block hover:text-teal">
                      <div className="flex items-center gap-2 text-sm"><span className="min-w-0 truncate">{n.title}</span>{n.placeholder && PH}</div>
                      <div className="micro normal-case tracking-wide">{when(n.editedAt, now)}{n.week ? ` · week ${n.week}` : ""}</div>
                      {n.preview && <div className="mt-0.5 line-clamp-2 text-xs text-muted">{n.preview}</div>}
                    </Link>
                    {n.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">{n.tags.slice(0, 4).map((t) => <button key={t} onClick={() => { setTag(t); setMod(m.code); }} className="micro rounded-sm border border-line px-1.5 py-0.5 !text-[9px] hover:border-teal/50">{t}</button>)}</div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-line pt-2">
                <div className="micro mb-1">Upcoming deadlines</div>
                {m.deadlines.length === 0 ? (
                  <div className="text-xs text-muted">None. Add assessments on the <Link href="/timetable" className="text-teal underline decoration-dotted">Timetable</Link>.</div>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {m.deadlines.map((d) => {
                      const n = daysTo(d.dueDate, today);
                      return (
                        <li key={d.id} className="flex justify-between gap-2">
                          <span className="truncate">{d.title}{d.weight ? ` (${d.weight}%)` : ""}</span>
                          <span className={`shrink-0 font-mono ${n <= 7 ? "text-magenta" : "text-muted"}`}>{n === 0 ? "today" : `${n}d`} · {d.dueDate.slice(5)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn" onClick={() => { setMod(m.code); setTag("all"); document.getElementById("note-list")?.scrollIntoView({ behavior: "smooth" }); }}>All notes</button>
                {m.notionUrl && <a href={m.notionUrl} target="_blank" rel="noreferrer" className="btn inline-flex items-center gap-1 !border-line !text-muted hover:!text-teal">Notion <ExternalLink className="h-3 w-3" /></a>}
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel label={`ALL NOTES // ${list.length}`} className="scroll-mt-20">
        <div id="note-list" className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all notes…" aria-label="Search all notes" className="field sm:!w-72" />
            <select value={mod} onChange={(e) => setMod(e.target.value)} className="field !w-auto" aria-label="Module">
              <option value="all">All modules</option>
              {modules.map((m) => <option key={m.code} value={m.code}>{m.code}</option>)}
            </select>
            <select value={term} onChange={(e) => setTerm(e.target.value)} className="field !w-auto" aria-label="Term">
              <option value="all">All terms</option>
              {terms.map((t) => <option key={t}>{t}</option>)}
            </select>
            {(mod !== "all" || tag !== "all" || term !== "all" || q) && (
              <button className="micro underline decoration-dotted hover:text-teal" onClick={() => { setMod("all"); setTag("all"); setTerm("all"); setQ(""); }}>clear filters</button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(([t, c]) => (
              <button key={t} onClick={() => setTag(tag === t ? "all" : t)} aria-pressed={tag === t}
                className={`micro rounded-sm border px-2 py-1 transition-colors ${tag === t ? "border-violet/70 bg-violet/15 text-text" : "border-line hover:border-violet/40"}`}>
                {t} <span className="text-teal">{c}</span>
              </button>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted">No notes match those filters.</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((n) => (
              <li key={n.id} className="py-2.5">
                <Link href={`/notes/${n.id}`} className="flex items-start gap-3 hover:text-teal">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: color.get(n.module) }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm">{n.title}{n.placeholder && PH}</span>
                    <span className="micro block normal-case tracking-wide">{n.module} · {n.term}{n.week ? ` · week ${n.week}` : ""} · {when(n.editedAt, now)} · {n.words} words</span>
                    {n.preview && <span className="line-clamp-1 text-xs text-muted">{n.preview}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
