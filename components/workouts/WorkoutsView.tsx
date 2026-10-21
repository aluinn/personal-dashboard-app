"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Flame, Plus, RotateCcw, Watch } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CountUp from "@/components/ui/CountUp";
import Panel from "@/components/ui/Panel";
import { saveWeeklyTarget } from "@/app/workout-actions";
import type { BodyRow, Template } from "@/lib/db/workouts";
import { londonToday } from "@/lib/time";
import { draftFromSession, draftRepeat, blankDraft, newPRsFor, type Draft } from "@/lib/workout-draft";
import type { PosterData } from "@/lib/poster";
import {
  addDaysISO, dayMap, exerciseNames, exerciseSeries, heatmap, linkWatch, muscleSets, recentPRs, sessionVolume, tonnes, weekStreak, weeklyCounts, weeklyVolume,
  type LinkedSession, type WSession, type WatchWorkout,
} from "@/lib/workouts";
import BodyPanel from "./BodyPanel";
import GoalRing from "./GoalRing";
import ShareButton from "./ShareButton";
import SphereLoader from "./SphereLoader";
import { levelOf } from "./ProgressSphere";
import WorkoutLogger from "./WorkoutLogger";
import { Heatmap, MuscleRadar, PR_COLOR, StrengthChart, WeeklyVolumeChart } from "./WorkoutCharts";

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const catToType = (t: string) => (/run/i.test(t) ? "run" : /cycl|bik/i.test(t) ? "cycle" : /strength|functional|core|hiit|high/i.test(t) ? "full body" : "sport");

function PRBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="pr-badge inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em]" style={{ borderColor: PR_COLOR, color: PR_COLOR, background: "rgba(255,179,71,0.1)" }}>
      New PR {children}
    </span>
  );
}

function summary(s: WSession) {
  if (s.exercises.length === 0) return s.distanceKm ? `${s.distanceKm} km` : "";
  return s.exercises.slice(0, 4).map((e) => {
    const best = e.sets.reduce((a, x) => (x.weightKg > a.weightKg ? x : a), e.sets[0]);
    return `${e.name} ${e.sets.length}×${best.reps}${best.weightKg ? ` @ ${best.weightKg}` : ""}`;
  }).join(" · ") + (s.exercises.length > 4 ? ` +${s.exercises.length - 4}` : "");
}

export default function WorkoutsView({ sessions, watches, templates, body, target }: { sessions: WSession[]; watches: WatchWorkout[]; templates: Template[]; body: BodyRow[]; target: number }) {
  const today = londonToday();
  const router = useRouter();
  const sp = useSearchParams();
  // /health/workouts?log=1 (from the command palette) opens the logger straight away.
  const [logger, setLogger] = useState<{ open: boolean; draft: Draft }>({ open: sp.get("log") === "1", draft: blankDraft(today) });
  useEffect(() => {
    if (sp.get("log")) router.replace("/health/workouts");
  }, [sp, router]);
  const [ex, setEx] = useState<string | null>(null);
  const [tgt, setTgt] = useState(String(target));
  const [prToast, setPrToast] = useState<{ name: string; e1rm: number }[] | null>(null);
  const [, startT] = useTransition();

  const { linked, unmatched } = useMemo(() => linkWatch(sessions, watches), [sessions, watches]);
  const days = useMemo(() => dayMap(linked, unmatched), [linked, unmatched]);
  const weekly12 = useMemo(() => weeklyVolume(days, today, 12), [days, today]);
  const heat26 = useMemo(() => heatmap(days, today, 26), [days, today]);
  const counts = useMemo(() => weeklyCounts(days, today, 52), [days, today]);
  const thisWeek = counts[counts.length - 1]?.count ?? 0;
  const streak = weekStreak(counts, target);
  const totalKg = useMemo(() => sessions.reduce((a, s) => a + sessionVolume(s), 0), [sessions]);
  const lvl = levelOf(totalKg);
  const names = useMemo(() => exerciseNames(sessions).filter((n) => exerciseSeries(sessions, n.name).length > 0), [sessions]);
  const prs30 = useMemo(() => recentPRs(sessions, today, 30), [sessions, today]);
  const muscle = useMemo(() => muscleSets(sessions, today, 30), [sessions, today]);
  const last = sessions.length ? [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)[sessions.length - 1] : null;

  const defaultEx = names.find((n) => exerciseSeries(sessions, n.name).length >= 2)?.name ?? names[0]?.name ?? null;
  const exName = ex && names.some((n) => n.name === ex) ? ex : defaultEx;
  const pts = exName ? exerciseSeries(sessions, exName) : [];
  const lastPR = [...pts].reverse().find((p) => p.isPR);
  const freshPR = lastPR && lastPR.date >= addDaysISO(today, -14) ? lastPR : null;
  const sessions30 = [...days.values()].filter((d) => d.date >= addDaysISO(today, -29)).reduce((a, d) => a + d.sessions, 0);

  const openLogger = (draft: Draft) => setLogger({ open: true, draft });
  const rows: (LinkedSession | { watchOnly: WatchWorkout; date: string })[] = [
    ...linked,
    ...unmatched.map((w) => ({ watchOnly: w, date: w.date })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 16);

  const buildPoster = (): PosterData => {
    const from = addDaysISO(today, -89);
    const inWin = [...days.values()].filter((d) => d.date >= from);
    const lifts = names
      .map((n) => ({ n, pts: exerciseSeries(sessions, n.name).filter((p) => p.date >= from) }))
      .filter((x) => x.pts.length > 0)
      .sort((a, b) => b.pts.length - a.pts.length)
      .slice(0, 4)
      .map(({ n, pts: p }) => ({
        name: n.name,
        start: p[0].e1rm,
        current: p[p.length - 1].e1rm,
        deltaPct: (p[p.length - 1].e1rm / p[0].e1rm - 1) * 100,
        pr: p.some((x) => x.isPR),
      }));
    return {
      name: "Aluinn",
      rangeLabel: `${fmtDate(from)} – ${fmtDate(today)}`,
      stats: [
        { label: "Workouts", value: String(inWin.reduce((a, d) => a + d.sessions, 0)) },
        { label: "Volume lifted", value: tonnes(inWin.reduce((a, d) => a + d.volumeKg, 0)) },
        { label: "New PRs", value: String(recentPRs(sessions, today, 90).length) },
        { label: "Week streak", value: String(streak.current) },
      ],
      heat: heatmap(days, today, 13),
      weekly: weeklyVolume(days, today, 13),
      lifts,
    };
  };

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn inline-flex items-center gap-1.5 !bg-teal/15 !px-4 !py-2.5" onClick={() => openLogger(blankDraft(today))}>
          <Plus className="h-4 w-4" /> Log workout
        </button>
        <button
          className="btn inline-flex items-center gap-1.5 !py-2.5 disabled:opacity-40"
          disabled={!last}
          onClick={() => last && openLogger(draftRepeat(last, today))}
          title={last ? `Same lifts and weights as ${fmtDate(last.date)}` : "Log a session first"}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Repeat last session
        </button>
        <div className="ml-auto flex items-center gap-3">
          <label className="micro flex items-center gap-2">
            Weekly goal
            <input
              type="number" min={1} max={14} value={tgt} aria-label="Workouts per week target"
              onChange={(e) => setTgt(e.target.value)}
              onBlur={() => { const n = Number(tgt); if (Number.isFinite(n) && n !== target) startT(() => saveWeeklyTarget(n)); }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="field !w-14 text-center"
            />
          </label>
          <ShareButton build={buildPoster} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Panel label="PROGRESS SPHERE" meta={`level ${lvl.level}`} accent="violet" className="min-h-[340px] xl:col-span-6">
          <div className="absolute inset-0 top-9">
            <SphereLoader level={lvl.level} fraction={lvl.fraction} />
          </div>
          <div className="pointer-events-none absolute bottom-4 left-4">
            <div className="font-mono text-3xl font-light text-teal glow-text">{totalKg >= 1000 ? <CountUp to={totalKg / 1000} decimals={totalKg >= 10000 ? 0 : 1} suffix=" t" /> : <CountUp to={totalKg} suffix=" kg" />}</div>
            <div className="micro">lifted all-time · {Math.round(lvl.fraction * 100)}% to {lvl.next} t</div>
          </div>
          <div className="micro pointer-events-none absolute bottom-4 right-4 max-w-[190px] text-right normal-case tracking-wide">The sphere fills as volume builds toward each milestone, then levels up and grows.</div>
        </Panel>

        <Panel label="THIS WEEK" delay={0.05} className="xl:col-span-3">
          <div className="flex flex-col items-center gap-3">
            <GoalRing value={thisWeek} target={target} />
            <div className="micro text-center normal-case tracking-wide">Counts logged sessions plus Apple Watch workouts you haven’t logged (each workout once).</div>
          </div>
        </Panel>

        <div className="grid gap-4 xl:col-span-3">
          <Panel label="WEEK STREAK" delay={0.1} className="!p-3">
            <div className="flex items-center gap-3">
              <Flame className={`h-8 w-8 ${streak.current > 0 ? "text-[#ffb347]" : "text-muted"}`} style={streak.current > 0 ? { filter: "drop-shadow(0 0 8px rgba(255,179,71,0.7))" } : undefined} />
              <div>
                <div className="font-mono text-3xl font-light text-teal glow-text"><CountUp to={streak.current} /> <span className="text-base text-muted">wk</span></div>
                <div className="micro normal-case tracking-wide">hitting {target}/week · best {streak.longest}</div>
              </div>
            </div>
          </Panel>
          <Panel label="LAST 30 DAYS" delay={0.12} className="!p-3">
            <div className="font-mono text-2xl font-light text-teal glow-text"><CountUp to={sessions30} /> <span className="text-base text-muted">workouts</span></div>
            <div className="micro mt-1 normal-case tracking-wide">{prs30.length} new PR{prs30.length === 1 ? "" : "s"}</div>
          </Panel>
          <Panel label="RECENT PRs" delay={0.14} className="!p-3">
            {prs30.length === 0 ? (
              <p className="text-xs text-muted">No PRs in the last 30 days yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {prs30.slice(0, 3).map((p) => (
                  <li key={p.name + p.date} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{p.name}</span>
                    <span className="font-mono text-[#ffb347]">{Math.round(p.e1rm)} kg</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Panel label="STRENGTH PROGRESSION">
        {names.length === 0 ? (
          <p className="text-sm text-muted">Log lifts with weights and your estimated 1RM trend appears here, with PR markers.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <select value={exName ?? ""} onChange={(e) => setEx(e.target.value)} aria-label="Exercise" className="field !w-auto min-w-[200px]">
                {names.map((n) => (<option key={n.name} value={n.name}>{n.name} ({n.sessions})</option>))}
              </select>
              <AnimatePresence>
                {freshPR && (
                  <motion.span key={exName} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <PRBadge>{Math.round(freshPR.e1rm)} kg e1RM · {freshPR.weightKg}×{freshPR.reps}</PRBadge>
                  </motion.span>
                )}
              </AnimatePresence>
              {pts.length > 1 && <span className="micro normal-case tracking-wide">{pts[0].e1rm < pts[pts.length - 1].e1rm ? "+" : ""}{(pts[pts.length - 1].e1rm - pts[0].e1rm).toFixed(1)} kg since {pts[0].date}</span>}
            </div>
            {pts.length < 2 ? <p className="text-sm text-muted">Log this lift at least twice to see a trend. Current estimate: {pts[0] ? `${Math.round(pts[0].e1rm)} kg` : "–"}.</p> : <StrengthChart points={pts} name={exName ?? ""} />}
          </>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel label="VOLUME"><WeeklyVolumeChart data={weekly12} /></Panel>
        <Panel label="CONSISTENCY"><Heatmap cells={heat26} /></Panel>
        <Panel label="BALANCE"><MuscleRadar sets={muscle} days={30} /></Panel>
        <Panel label="BODY METRICS // OPTIONAL" accent="violet"><BodyPanel rows={body} today={today} /></Panel>
      </div>

      <Panel label="SESSIONS">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No workouts yet. Hit “Log workout”, or import your Apple Watch data in Settings and your workouts appear here.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) =>
              "watchOnly" in r ? (
                <li key={`w${r.watchOnly.id}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm"><Watch className="h-3.5 w-3.5 text-violet" /> {r.watchOnly.type}<span className="micro">{fmtDate(r.date)}</span></div>
                    <div className="micro normal-case tracking-wide">Apple Watch · {Math.round(r.watchOnly.durationMin ?? 0)} min{r.watchOnly.activeKcal ? ` · ${Math.round(r.watchOnly.activeKcal)} kcal` : ""}{r.watchOnly.avgHr ? ` · avg ${Math.round(r.watchOnly.avgHr)} bpm` : ""}{r.watchOnly.distanceKm ? ` · ${r.watchOnly.distanceKm.toFixed(1)} km` : ""}</div>
                  </div>
                  <button className="btn" onClick={() => openLogger({ ...blankDraft(r.date, catToType(r.watchOnly.type)), durationMin: String(Math.round(r.watchOnly.durationMin ?? 0) || ""), distanceKm: r.watchOnly.distanceKm ? r.watchOnly.distanceKm.toFixed(1) : "" })}>Log details</button>
                </li>
              ) : (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <button className="min-w-0 flex-1 text-left" onClick={() => openLogger(draftFromSession(r))}>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="capitalize">{r.type}</span><span className="micro">{fmtDate(r.date)}</span>
                      {r.durationMin ? <span className="micro">{Math.round(r.durationMin)} min</span> : null}
                      {sessionVolume(r) > 0 && <span className="micro text-teal">{tonnes(sessionVolume(r))}</span>}
                      {r.watch && (
                        <span className="micro inline-flex items-center gap-1 rounded-sm border border-violet/40 px-1.5 py-0.5 !text-[9px] text-violet">
                          <Watch className="h-3 w-3" /> {r.watch.activeKcal ? `${Math.round(r.watch.activeKcal)} kcal` : "Watch"}{r.watch.avgHr ? ` · ${Math.round(r.watch.avgHr)} bpm` : ""}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted">{summary(r)}</div>
                  </button>
                  <button className="micro hover:text-teal" onClick={() => openLogger(draftRepeat(r, today))}>Repeat</button>
                </li>
              ),
            )}
          </ul>
        )}
      </Panel>

      <WorkoutLogger
        open={logger.open}
        draft={logger.draft}
        history={sessions}
        templates={templates}
        watches={watches}
        onClose={() => setLogger((l) => ({ ...l, open: false }))}
        onSaved={(d) => {
          const prs = newPRsFor(sessions, d);
          if (prs.length) {
            setPrToast(prs);
            setTimeout(() => setPrToast(null), 7000);
          }
        }}
      />

      <AnimatePresence>
        {prToast && (
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 space-y-2 rounded-sm border border-[#ffb347]/60 bg-[#0a1115] p-3 shadow-[0_0_30px_-6px_rgba(255,179,71,0.6)]">
            {prToast.map((p) => (<div key={p.name}><PRBadge>{p.name} · {Math.round(p.e1rm)} kg e1RM</PRBadge></div>))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
