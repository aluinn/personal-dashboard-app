"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { deleteWorkout, saveTemplate, saveWorkout } from "@/app/workout-actions";
import { BUILTIN_TEMPLATES, LIBRARY, MUSCLES, WORKOUT_TYPES, categoryOfType, inferMuscle } from "@/lib/exercises";
import type { Template } from "@/lib/db/workouts";
import {
  blankExercise, blankSet, draftFromTemplate, draftStats, newKey, toPayload, toTemplateExercises, type Draft, type DraftEx,
} from "@/lib/workout-draft";
import { epley, tonnes, type WSession, type WatchWorkout } from "@/lib/workouts";

export default function WorkoutLogger({
  open,
  draft: initial,
  history,
  templates,
  watches,
  onClose,
  onSaved,
}: {
  open: boolean;
  draft: Draft;
  history: WSession[];
  templates: Template[];
  watches: WatchWorkout[];
  onClose: () => void;
  onSaved: (d: Draft) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
          <motion.aside
            initial={{ x: 40 }}
            animate={{ x: 0 }}
            exit={{ x: 40 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-[100dvh] w-full max-w-xl flex-col border-l border-teal/30 bg-[#0a1115]"
          >
            <LoggerBody key={initial.id ?? initial.date + initial.exercises.length + initial.type} initial={initial} history={history} templates={templates} watches={watches} onClose={onClose} onSaved={onSaved} />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LoggerBody({ initial, history, templates, watches, onClose, onSaved }: { initial: Draft; history: WSession[]; templates: Template[]; watches: WatchWorkout[]; onClose: () => void; onSaved: (d: Draft) => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [tplName, setTplName] = useState<string | null>(null);
  const cat = categoryOfType(d.type);
  const stats = draftStats(d);

  // names for autocomplete: library + everything you've logged before
  const names = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of LIBRARY) seen.set(e.name.toLowerCase(), e.name);
    for (const h of history) for (const e of h.exercises) seen.set(e.name.toLowerCase(), e.name);
    return [...seen.values()].sort();
  }, [history]);

  // most recent previous performance of each lift, for the "last time" hint
  const lastFor = (name: string) => {
    const k = name.trim().toLowerCase();
    if (!k) return null;
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (h.id === d.id || h.date > d.date) continue;
      const e = h.exercises.find((x) => x.name.trim().toLowerCase() === k);
      if (e && e.sets.length) return { date: h.date, sets: e.sets };
    }
    return null;
  };

  const watchHere = watches.find((w) => w.date === d.date && (cat === "strength" ? /strength|functional|core|hiit|high/i.test(w.type) : new RegExp(cat === "run" ? "run" : cat === "cycle" ? "cycl|bik" : ".", "i").test(w.type)));

  const patch = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const patchEx = (key: string, p: Partial<DraftEx>) => setD((x) => ({ ...x, exercises: x.exercises.map((e) => (e.key === key ? { ...e, ...p } : e)) }));

  const save = () => {
    setError("");
    start(async () => {
      try {
        const payload = toPayload(d);
        onSaved(d); // lets the page work out any new PRs against pre-save history
        const id = await saveWorkout(payload);
        if (tplName !== null && tplName.trim()) await saveTemplate({ name: tplName, type: d.type, exercises: toTemplateExercises(d) });
        void id;
        onClose();
      } catch (e) {
        setError((e as Error).message || "Couldn't save");
      }
    });
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="micro text-teal">{d.id ? "Edit workout" : "Log workout"}</span>
        <button onClick={onClose} aria-label="Close" className="p-1 text-muted hover:text-teal"><X className="h-5 w-5" /></button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {/* type chips */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Workout type">
          {WORKOUT_TYPES.map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={d.type === t}
              onClick={() => patch({ type: t })}
              className={`micro shrink-0 rounded-sm border px-3 py-2 transition-colors ${d.type === t ? "border-teal bg-teal/15 text-teal" : "border-line hover:border-teal/40"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="micro">Date</span>
            <input type="date" value={d.date} onChange={(e) => patch({ date: e.target.value })} className="field" />
          </label>
          <label className="space-y-1">
            <span className="micro">Duration (min)</span>
            <input type="number" inputMode="numeric" min={0} value={d.durationMin} onChange={(e) => patch({ durationMin: e.target.value })} placeholder="60" className="field" />
          </label>
          {(cat === "run" || cat === "cycle" || cat === "other") && (
            <label className="space-y-1">
              <span className="micro">Distance (km)</span>
              <input type="number" inputMode="decimal" min={0} step="0.01" value={d.distanceKm} onChange={(e) => patch({ distanceKm: e.target.value })} className="field" />
            </label>
          )}
          <div className="col-span-full flex flex-wrap gap-2">
            {[30, 45, 60, 75, 90].map((m) => (
              <button key={m} onClick={() => patch({ durationMin: String(m) })} className="micro rounded-sm border border-line px-2.5 py-1.5 hover:border-teal/50">{m} min</button>
            ))}
          </div>
        </div>

        {watchHere && (
          <div className="rounded-sm border border-violet/40 bg-violet/10 p-2.5 text-xs">
            Apple Watch recorded <b>{watchHere.type}</b> that day: {Math.round(watchHere.durationMin ?? 0)} min
            {watchHere.activeKcal ? ` · ${Math.round(watchHere.activeKcal)} kcal` : ""}
            {watchHere.avgHr ? ` · avg ${Math.round(watchHere.avgHr)} bpm` : ""}. It will link to this session automatically.
            {watchHere.durationMin ? (
              <button className="ml-2 underline decoration-dotted hover:text-teal" onClick={() => patch({ durationMin: String(Math.round(watchHere.durationMin!)) })}>Use its duration</button>
            ) : null}
          </div>
        )}

        {/* templates */}
        <label className="block space-y-1">
          <span className="micro">Start from a template</span>
          <select
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const t = v.startsWith("u") ? templates.find((x) => x.id === Number(v.slice(1))) : BUILTIN_TEMPLATES[Number(v.slice(1))];
              if (t) setD((x) => ({ ...draftFromTemplate(t.name, t.type, t.exercises, x.date), id: x.id, durationMin: x.durationMin, notes: x.notes }));
            }}
            className="field"
          >
            <option value="">Choose…</option>
            <optgroup label="Starter">
              {BUILTIN_TEMPLATES.map((t, i) => (<option key={t.name} value={`b${i}`}>{t.name}</option>))}
            </optgroup>
            {templates.length > 0 && (
              <optgroup label="Mine">
                {templates.map((t) => (<option key={t.id} value={`u${t.id}`}>{t.name}</option>))}
              </optgroup>
            )}
          </select>
        </label>

        {/* exercises */}
        <datalist id="exercise-names">{names.map((n) => (<option key={n} value={n} />))}</datalist>
        <div className="space-y-3">
          {d.exercises.map((e) => {
            const last = lastFor(e.name);
            const best = last ? last.sets.reduce((a, s) => (epley(s.weightKg, s.reps) > epley(a.weightKg, a.reps) ? s : a)) : null;
            return (
              <div key={e.key} className="space-y-2 rounded-sm border border-line p-3">
                <div className="flex items-center gap-2">
                  <input
                    list="exercise-names"
                    value={e.name}
                    onChange={(ev) => patchEx(e.key, { name: ev.target.value, muscle: inferMuscle(ev.target.value) })}
                    placeholder="Exercise"
                    aria-label="Exercise name"
                    className="field flex-1 !font-medium"
                  />
                  <select value={e.muscle} onChange={(ev) => patchEx(e.key, { muscle: ev.target.value })} aria-label="Muscle group" className="field !w-[116px]">
                    {MUSCLES.map((m) => (<option key={m.key} value={m.key}>{m.label}</option>))}
                    <option value="other">Other</option>
                  </select>
                  <button onClick={() => setD((x) => ({ ...x, exercises: x.exercises.filter((y) => y.key !== e.key) }))} aria-label="Remove exercise" className="p-1.5 text-muted hover:text-magenta"><Trash2 className="h-4 w-4" /></button>
                </div>

                {last && best && (
                  <button
                    onClick={() => patchEx(e.key, { sets: last.sets.map((s) => ({ reps: String(s.reps), weightKg: s.weightKg ? String(s.weightKg) : "", rpe: "" })) })}
                    className="micro block w-full rounded-sm bg-white/[0.03] px-2 py-1.5 text-left normal-case tracking-wide hover:bg-teal/10"
                  >
                    Last time ({last.date.slice(5)}): {last.sets.length} sets, best {best.weightKg} kg × {best.reps}. <span className="text-teal">Tap to copy</span>
                  </button>
                )}

                <div className="grid grid-cols-[28px_1fr_1fr_64px_28px] items-center gap-2">
                  <span className="micro">Set</span><span className="micro">kg</span><span className="micro">Reps</span><span className="micro">RPE</span><span />
                  {e.sets.map((s, i) => (
                    <SetRow
                      key={i}
                      i={i}
                      s={s}
                      onChange={(p) => patchEx(e.key, { sets: e.sets.map((t, k) => (k === i ? { ...t, ...p } : t)) })}
                      onRemove={() => patchEx(e.key, { sets: e.sets.length > 1 ? e.sets.filter((_, k) => k !== i) : [blankSet()] })}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => patchEx(e.key, { sets: [...e.sets, e.sets.length ? { ...e.sets[e.sets.length - 1], rpe: "" } : blankSet()] })}
                    className="btn inline-flex items-center gap-1.5"
                  >
                    <Plus className="h-3 w-3" /> Set (copies last)
                  </button>
                  <input value={e.notes} onChange={(ev) => patchEx(e.key, { notes: ev.target.value })} placeholder="Notes (optional)" aria-label="Exercise notes" className="field !w-1/2" />
                </div>
              </div>
            );
          })}
          <button onClick={() => setD((x) => ({ ...x, exercises: [...x.exercises, { ...blankExercise(), key: newKey() }] }))} className="btn flex w-full items-center justify-center gap-2 !py-3">
            <Plus className="h-4 w-4" /> Add exercise
          </button>
        </div>

        <label className="block space-y-1">
          <span className="micro">Session notes</span>
          <textarea value={d.notes} onChange={(e) => patch({ notes: e.target.value })} rows={2} className="field" placeholder="How did it feel?" />
        </label>

        {tplName !== null && (
          <label className="block space-y-1">
            <span className="micro">Template name</span>
            <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="e.g. Push A" className="field" autoFocus />
          </label>
        )}
        {error && <p className="text-sm text-magenta">{error}</p>}
      </div>

      <div className="flex items-center gap-3 border-t border-line bg-[#0a1115] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1 text-xs text-muted">
          {stats.sets} sets · {tonnes(stats.volume)}
          <button className="ml-3 underline decoration-dotted hover:text-teal" onClick={() => setTplName((v) => (v === null ? "" : null))}>
            {tplName === null ? "Save as template" : "Don't save template"}
          </button>
        </div>
        {d.id && (
          <button
            aria-label="Delete workout"
            className="p-2 text-muted hover:text-magenta"
            onClick={() => { if (confirm("Delete this workout?")) start(async () => { await deleteWorkout(d.id!); onClose(); }); }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button className="btn !px-6 !py-3" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save"}</button>
      </div>
    </>
  );
}

function SetRow({ i, s, onChange, onRemove }: { i: number; s: { reps: string; weightKg: string; rpe: string }; onChange: (p: Partial<typeof s>) => void; onRemove: () => void }) {
  return (
    <>
      <span className="font-mono text-xs text-muted">{i + 1}</span>
      <input type="number" inputMode="decimal" step="0.5" min={0} value={s.weightKg} onChange={(e) => onChange({ weightKg: e.target.value })} aria-label={`Set ${i + 1} weight in kg`} placeholder="0" className="field !py-2.5 text-center" />
      <input type="number" inputMode="numeric" min={0} value={s.reps} onChange={(e) => onChange({ reps: e.target.value })} aria-label={`Set ${i + 1} reps`} placeholder="0" className="field !py-2.5 text-center" />
      <input type="number" inputMode="decimal" step="0.5" min={1} max={10} value={s.rpe} onChange={(e) => onChange({ rpe: e.target.value })} aria-label={`Set ${i + 1} RPE`} placeholder="–" className="field !py-2.5 text-center" />
      <button onClick={onRemove} aria-label={`Remove set ${i + 1}`} className="text-muted hover:text-magenta"><X className="h-4 w-4" /></button>
    </>
  );
}
