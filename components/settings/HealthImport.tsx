"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { clearHealthData } from "@/app/health-actions";

type Job = {
  id: number;
  name: string;
  size: number;
  phase: "queued" | "uploading" | "processing" | "done" | "error";
  pct: number;
  message: string;
  summary?: string[];
};

const mb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(n > 1e8 ? 0 : 1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

type ResultItem = {
  kind?: string;
  file?: string;
  note?: string;
  counts?: { nights?: number };
  saved?: { sleep: number; hr: number; hrv: number; steps: number; workouts: number };
};

function summarise(results: ResultItem[]) {
  return results.flatMap((r) => {
    const s = r.saved;
    const line = s
      ? `${r.file ? `${r.file}: ` : ""}${r.kind ?? "data"}. ${s.sleep} sleep session${s.sleep === 1 ? "" : "s"}, ${s.hr} heart-rate day${s.hr === 1 ? "" : "s"}, ${s.hrv} HRV day${s.hrv === 1 ? "" : "s"}, ${s.steps} activity day${s.steps === 1 ? "" : "s"}, ${s.workouts} workout${s.workouts === 1 ? "" : "s"}`
      : `${r.kind ?? "done"}`;
    return r.note ? [line, r.note] : [line];
  });
}

function upload(file: File, update: (p: Partial<Job>) => void) {
  return new Promise<void>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/import/health");
    xhr.setRequestHeader("x-filename", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && update({ phase: "uploading", pct: Math.round((e.loaded / e.total) * 100), message: `Uploading… ${Math.round((e.loaded / e.total) * 100)}%` });
    let consumed = 0;
    const readLines = () => {
      const text = xhr.responseText;
      const lines = text.slice(consumed).split("\n");
      lines.pop(); // trailing partial line
      consumed += lines.reduce((a, l) => a + l.length + 1, 0);
      for (const l of lines) {
        try {
          const m = JSON.parse(l);
          if (m.type === "progress") update({ phase: "processing", pct: m.pct ?? 0, message: m.message });
          else if (m.type === "done") update({ phase: "done", pct: 100, message: "Imported", summary: summarise(m.results) });
          else if (m.type === "error") update({ phase: "error", message: m.message });
        } catch {
          /* ignore partial JSON */
        }
      }
    };
    xhr.onprogress = readLines;
    xhr.onload = () => {
      if (xhr.status >= 400) {
        update({ phase: "error", message: xhr.status === 403 ? "Upload blocked (open the dashboard from its own address)." : `Failed (${xhr.status})` });
      } else readLines();
      resolve();
    };
    xhr.onerror = () => {
      update({ phase: "error", message: "Network error during upload." });
      resolve();
    };
    update({ phase: "uploading", pct: 0, message: "Uploading…" });
    xhr.send(file);
  });
}

export default function HealthImport({ ingestConfigured, counts }: { ingestConfigured: boolean; counts: { nights: number; hr: number; hrv: number; steps: number; workouts: number; first: string | null; last: string | null } }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const busy = useRef(false);

  const run = useCallback(async (files: File[]) => {
    const fresh: Job[] = files.map((f) => ({ id: nextId.current++, name: f.name, size: f.size, phase: "queued", pct: 0, message: "Waiting…" }));
    setJobs((j) => [...fresh, ...j]);
    if (busy.current) return;
    busy.current = true;
    for (let i = 0; i < files.length; i++) {
      await upload(files[i], (p) => setJobs((all) => all.map((j) => (j.id === fresh[i].id ? { ...j, ...p } : j))));
    }
    busy.current = false;
    router.refresh(); // update the "on file" counts and every page that reads this data
  }, [router]);

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); run([...e.dataTransfer.files]); }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        className={`cursor-pointer rounded-sm border border-dashed p-8 text-center transition-colors ${over ? "border-teal bg-teal/[0.06]" : "border-line hover:border-teal/50"}`}
      >
        <div className="text-sm">Drop <span className="text-teal">export.zip</span> / <span className="text-teal">export.xml</span> from Apple Health, or CSV / JSON files from Health Auto Export</div>
        <div className="micro mt-2 normal-case tracking-wide">or click to choose · big exports are fine, they’re streamed and nothing is loaded into memory whole · re-importing the same file never duplicates data</div>
        <input ref={input} type="file" multiple accept=".zip,.xml,.csv,.tsv,.json,.txt" className="hidden" onChange={(e) => { if (e.target.files) run([...e.target.files]); e.target.value = ""; }} />
      </div>

      {jobs.length > 0 && (
        <ul className="space-y-2">
          {jobs.slice(0, 6).map((j) => (
            <li key={j.id} className="rounded-sm border border-line p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{j.name} <span className="micro">{mb(j.size)}</span></span>
                <span className={`micro ${j.phase === "error" ? "!text-magenta" : j.phase === "done" ? "!text-teal" : ""}`}>{j.message}</span>
              </div>
              {(j.phase === "uploading" || j.phase === "processing") && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5"><div className="flow-gradient h-full transition-[width]" style={{ width: `${j.pct}%` }} /></div>
              )}
              {j.summary?.map((s, i) => <p key={i} className="mt-1.5 text-xs text-muted">{s}</p>)}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p className="text-xs text-muted">
          On file: <span className="text-text">{counts.nights}</span> sleep sessions{counts.first ? ` (${counts.first} → ${counts.last})` : ""}, <span className="text-text">{counts.hr}</span> heart-rate days, <span className="text-text">{counts.hrv}</span> HRV days, <span className="text-text">{counts.steps}</span> activity days, <span className="text-text">{counts.workouts}</span> workouts.
        </p>
        {counts.nights + counts.hr + counts.hrv + counts.steps + counts.workouts > 0 && (
          <button className="micro hover:text-magenta" onClick={async () => { if (confirm("Delete ALL imported health data (sleep, heart rate, HRV, steps, workouts) and your manual sleep entries? This can't be undone.")) await clearHealthData(); }}>
            Clear all health data
          </button>
        )}
      </div>

      <details className="rounded-sm border border-line p-3 text-sm">
        <summary className="micro cursor-pointer text-text">How to export from your iPhone / Apple Watch, step by step</summary>
        <div className="mt-3 space-y-4 text-xs leading-relaxed text-muted">
          <div>
            <div className="text-sm text-text">A · Everything, once (Apple Health export)</div>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Open the <b>Health</b> app on your iPhone and tap your <b>profile picture</b> (top right).</li>
              <li>Scroll to the bottom and tap <b>Export All Health Data</b>, then <b>Export</b>. It takes a minute or two.</li>
              <li>In the share sheet choose <b>AirDrop</b> (to your Mac) or <b>Save to Files</b> (iCloud Drive, then open it on the Mac).</li>
              <li>Drop the resulting <code>export.zip</code> onto the box above. This page reads only sleep, heart rate, resting heart rate, HRV, steps, active energy and workouts; the rest of the file is ignored.</li>
            </ol>
            <p className="mt-1">Sleep stages (Core / Deep / REM / Awake) only exist for nights recorded on an Apple Watch with sleep tracking. iPhone-only nights import as total time.</p>
          </div>
          <div>
            <div className="text-sm text-text">B · Regular manual exports (Health Auto Export app, CSV or JSON)</div>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Install <b>Health Auto Export – JSON+CSV</b> from the App Store and allow it access to Health.</li>
              <li>Open its <b>Export</b> (Health Metrics) screen and tick: <b>Sleep Analysis, Heart Rate, Resting Heart Rate, Heart Rate Variability, Step Count, Active Energy</b>. Add <b>Workouts</b> if you want them.</li>
              <li>Pick a date range and the format (<b>CSV</b> or <b>JSON</b>; for JSON choose Export Version 2), then export and AirDrop / Save to Files.</li>
              <li>Drop the file (or the zip it creates) here. Menu names can differ a little between app versions. I read columns by name and tell you which ones I used, so if something isn’t picked up you’ll see it listed above.</li>
            </ol>
          </div>
          <div>
            <div className="text-sm text-text">C · Automatic sync (later): Health Auto Export → this dashboard</div>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Put a long random string in <code>INGEST_SECRET</code> in <code>.env.local</code> (generate with <code>openssl rand -hex 24</code>) and restart. Status: <span className={ingestConfigured ? "text-teal" : "text-magenta"}>{ingestConfigured ? "secret set" : "not set yet"}</span>.</li>
              <li>In Health Auto Export open <b>Automations</b> → add a <b>REST API</b> automation, choose the same metrics, format <b>JSON</b>, Export Version 2, and a schedule (e.g. every hour).</li>
              <li>URL: <code>http://YOUR-MAC-IP:3000/api/ingest/health</code>. Add the header <code>Authorization: Bearer YOUR_SECRET</code>.</li>
              <li>For the phone to reach your Mac it must be on the same Wi-Fi and the app must listen on the network: run <code>npm run dev -- -H 0.0.0.0</code>. Your Mac’s address is in System Settings → Wi-Fi → Details. The Mac must be awake and the dashboard running when the sync fires. Not verified: iOS may refuse plain <code>http://</code> in some apps. If it does, use a secure tunnel (Tailscale or a Cloudflare Tunnel) and put that <code>https://</code> address in instead.</li>
            </ol>
          </div>
          <div>
            <div className="text-sm text-text">D · Your own script or iOS Shortcut: simple JSON</div>
            <pre className="mt-1 overflow-x-auto rounded-sm border border-line p-2 text-[11px] text-text/80">{`curl -X POST http://localhost:3000/api/ingest/health \\
  -H "Authorization: Bearer $INGEST_SECRET" -H "Content-Type: application/json" \\
  -d '{
    "sleep":     [{"night":"2026-10-20","start":"2026-10-19T23:30:00+01:00","end":"2026-10-20T07:10:00+01:00",
                   "asleepHours":7.2,"deepHours":1.3,"remHours":1.8,"coreHours":4.1,"awakeHours":0.3}],
    "heartRate": [{"day":"2026-10-20","avg":68,"min":48,"max":142,"resting":56}],
    "hrv":       [{"day":"2026-10-20","avg":58}],
    "steps":     [{"day":"2026-10-20","steps":9100,"activeKcal":520}],
    "workouts":  [{"type":"Running","start":"2026-10-20T08:00:00+01:00","end":"2026-10-20T08:32:00+01:00","durationMin":32,"distanceKm":5.1,"activeKcal":402}]
  }'`}</pre>
            <p className="mt-1">Sending a day again updates it rather than duplicating it. When the same night arrives from several places, your manual entry wins, then the Apple export, then Health Auto Export, then this endpoint.</p>
          </div>
        </div>
      </details>
    </div>
  );
}
