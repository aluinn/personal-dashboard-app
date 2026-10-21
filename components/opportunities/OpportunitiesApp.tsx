"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link2, Plus } from "lucide-react";
import Panel from "@/components/ui/Panel";
import type { Opportunity } from "@/lib/db/types";
import { scoreListing, tracksFor, TRACKS, type MatchConfig, type MatchResult, type TrackKey } from "@/lib/match";
import { CV_THRESHOLD, PIPELINE, guessFirmRole, timing } from "@/lib/opp";
import { londonDate } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { previewLink, setStatus } from "@/app/opportunities/actions";
import Board from "./Board";
import OppDialog, { type DialogValues } from "./OppDialog";
import SourcesPanel, { type SourceInfo } from "./SourcesPanel";
import { AlertsButton } from "./Notifier";
import { ScoreRing, TimingBadges } from "./parts";

export type Scored = Opportunity & { match: MatchResult; tracks: TrackKey[] };
type View = "pipeline" | "feed" | "sources";

type Dlg = { values: DialogValues; notice?: string; id?: number } | null;

export default function OpportunitiesApp({
  items,
  config,
  sources,
}: {
  items: Opportunity[];
  config: MatchConfig;
  sources: SourceInfo;
}) {
  const now = useNow(60000);
  const router = useRouter();
  const sp = useSearchParams();

  const [view, setView] = useState<View>("pipeline");
  const [track, setTrack] = useState<TrackKey | "all">("all");
  const [type, setType] = useState<"all" | "finance" | "tech">("all");
  const [cvOnly, setCvOnly] = useState(false);
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState("");
  const [busy, startQuick] = useTransition();

  // Bookmarklet capture: /opportunities?url=…&title=…&site=…&desc=…
  const [dlg, setDlg] = useState<Dlg>(() => {
    const url = sp.get("url");
    if (!url) return sp.get("add") === "1" ? { values: { status: "applied" } } : null;
    const { firm, role } = guessFirmRole(sp.get("title") ?? "", sp.get("site") ?? "");
    return {
      values: { link: url, firm, role, description: sp.get("desc") ?? "", status: "saved", source: "bookmarklet" },
      notice: "Captured from your browser. Check the details, then save.",
    };
  });
  useEffect(() => {
    if (sp.get("url") || sp.get("add")) router.replace("/opportunities");
  }, [sp, router]);

  const [optimistic, setOptimistic] = useOptimistic(items, (cur, u: { id: number; status: string }) =>
    cur.map((o) => (o.id === u.id ? { ...o, status: u.status } : o)),
  );
  const [, startMove] = useTransition();
  const move = (id: number, status: string) =>
    startMove(async () => {
      setOptimistic({ id, status });
      await setStatus(id, status);
    });

  const scored: Scored[] = useMemo(() => {
    const d = new Date(now ?? 0);
    return optimistic.map((o) => {
      const match = scoreListing(o, config, d);
      return { ...o, match, tracks: tracksFor(o, match) };
    });
  }, [optimistic, config, now]);

  if (now === null) return <div className="micro">Loading…</div>;
  const today = londonDate(now);

  const base = scored.filter((o) => {
    if (o.status === "dismissed") return false;
    if (type !== "all" && o.type !== type) return false;
    if (cvOnly && o.match.score < CV_THRESHOLD) return false;
    if (q && !`${o.firm} ${o.role}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const visible = track === "all" ? base : base.filter((o) => o.tracks.includes(track));
  const pipeline = visible.filter((o) => PIPELINE.some((p) => p.key === o.status));
  const feed = visible.filter((o) => o.status === "feed").sort((a, b) => b.match.score - a.match.score);
  const countFor = (k: TrackKey | "all") => (k === "all" ? base : base.filter((o) => o.tracks.includes(k))).length;

  const open = (o: Scored) =>
    setDlg({
      id: o.id,
      values: { id: o.id, firm: o.firm, role: o.role, type: o.type, programme: o.programme, status: o.status, deadline: o.deadline, opensOn: o.opensOn, link: o.link, notes: o.notes, description: o.description, location: o.location, source: o.source },
    });
  const dlgMatch = dlg?.id ? scored.find((s) => s.id === dlg.id)?.match : undefined;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {(["pipeline", "feed", "sources"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`btn ${view === v ? "bg-teal/15" : "!border-line !text-muted"}`}>
            {v}
            {v === "feed" && ` (${scored.filter((o) => o.status === "feed").length})`}
          </button>
        ))}
        <form
          className="ml-2 flex min-w-[260px] flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!quick.trim()) return;
            startQuick(async () => {
              const p = await previewLink(quick.trim());
              setDlg({
                values: { link: p.link, firm: p.firm, role: p.role, description: p.description, deadline: p.deadline, location: p.location, status: "saved", source: "link" },
                notice: p.ok ? "Fetched the page's title and description. Check, then save." : p.notice,
              });
              setQuick("");
            });
          }}
        >
          <Link2 className="h-4 w-4 shrink-0 text-muted" />
          <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Paste a job link to quick-add…" className="field" />
          <button className="btn" disabled={busy}>{busy ? "…" : "Fetch"}</button>
        </form>
        <button onClick={() => setDlg({ values: { status: "saved" } })} className="btn inline-flex items-center gap-1.5">
          <Plus className="h-3 w-3" /> Add
        </button>
        <AlertsButton />
      </div>

      {/* Filters */}
      {view !== "sources" && (
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "finance", "tech"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={`btn ${type === t ? "bg-teal/15" : "!border-line !text-muted"}`}>
              {t}
            </button>
          ))}
          <label className="micro ml-2 flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={cvOnly} onChange={(e) => setCvOnly(e.target.checked)} className="accent-[#2ee6d6]" />
            Matches my CV (≥{CV_THRESHOLD})
          </label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="field ml-auto !w-44" />
        </div>
      )}

      {view !== "sources" && (
        <div className="flex flex-wrap gap-2">
          {([{ key: "all", label: "All tracks" }, ...TRACKS] as { key: TrackKey | "all"; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTrack(t.key)}
              className={`micro rounded-sm border px-2.5 py-1.5 transition-colors ${track === t.key ? "border-violet/70 bg-violet/15 text-text" : "border-line hover:border-violet/40"}`}
            >
              {t.label} <span className="ml-1 text-teal">{countFor(t.key)}</span>
            </button>
          ))}
        </div>
      )}

      {view === "pipeline" && (
        pipeline.length === 0 && items.length === 0 ? (
          <Panel label="PIPELINE">
            <p className="mb-3 text-sm text-muted">
              Nothing tracked yet. Listings don’t appear on their own: you add them, import them, or connect a public source.
              {!sources.adzunaConfigured && " Adzuna isn’t connected (no API key), so the public feed is off."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => setDlg({ values: { status: "saved" } })}>Add one by hand</button>
              <button className="btn" onClick={() => setView("sources")}>Import a list / paste an email</button>
              {sources.adzunaConfigured && (
                <button className="btn" onClick={() => setView("sources")}>Refresh public sources</button>
              )}
            </div>
          </Panel>
        ) : (
          <Board items={pipeline} today={today} onOpen={open} onMove={move} />
        )
      )}

      {view === "feed" && (
        <Panel label="FEED // UNSORTED, BEST CV MATCH FIRST" accent="violet">
          {feed.length === 0 ? (
            <p className="text-sm text-muted">Feed is empty. Import a list, paste an alert email, or refresh public sources on the Sources tab.</p>
          ) : (
            <ul className="divide-y divide-line">
              {feed.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <ScoreRing score={o.match.score} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => open(o)}>
                    <div className="truncate text-sm">
                      {o.firm} <span className="text-muted">· {o.role}</span>
                    </div>
                    <div className="truncate text-[11px] text-muted">{o.match.why}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <TimingBadges t={timing(o, today)} />
                      {o.source === "adzuna" && (
                        <a href="https://www.adzuna.co.uk" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="micro !text-[9px] underline decoration-dotted">
                          via Adzuna
                        </a>
                      )}
                    </div>
                  </button>
                  {o.link && (
                    <a href={o.link} target="_blank" rel="noreferrer" className="micro hover:text-teal">Open</a>
                  )}
                  <button className="btn" onClick={() => move(o.id, "saved")}>Save</button>
                  <button className="micro hover:text-magenta" onClick={() => move(o.id, "dismissed")}>Dismiss</button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {view === "sources" && <SourcesPanel info={sources} onAdd={() => setDlg({ values: { status: "saved" } })} />}

      <OppDialog
        open={dlg !== null}
        values={dlg?.values ?? {}}
        notice={dlg?.notice}
        match={dlgMatch}
        onClose={() => setDlg(null)}
      />
    </div>
  );
}

