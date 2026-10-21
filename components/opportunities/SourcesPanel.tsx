"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Panel from "@/components/ui/Panel";
import { importEmailText, importRows, refreshPublicSources } from "@/app/opportunities/actions";
import { parseImport } from "@/lib/sources/import";
import type { ImportRow } from "@/lib/sources/types";

export type SourceInfo = {
  adzunaConfigured: boolean;
  adzunaCallsToday: number;
  adzunaCap: number;
  tavilyConfigured: boolean;
  tavilyCallsToday: number;
  tavilyCap: number;
  rssCount: number;
  lastRefresh: number | null;
  autoRefreshHours: number;
  ingestConfigured: boolean;
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Panel label={`SOURCE ${n} // ${title}`}>
      <div className="space-y-3 text-sm text-muted">{children}</div>
    </Panel>
  );
}

function ImportBox() {
  const [text, setText] = useState("");
  const [target, setTarget] = useState<"saved" | "feed">("feed");
  const [parsed, setParsed] = useState<{ rows: ImportRow[]; errors: string[] } | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setParsed(null);
          setMsg("");
        }}
        rows={5}
        placeholder={"Paste CSV, TSV (copied from a table) or JSON. First row = headers, e.g.\ncompany,role,deadline,opens,link"}
        className="field font-mono !text-xs"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".csv,.tsv,.json,.txt"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              setText(await f.text());
              setParsed(null);
            }
          }}
          className="micro max-w-[220px]"
        />
        <select value={target} onChange={(e) => setTarget(e.target.value as "saved" | "feed")} className="field !w-auto">
          <option value="feed">Add to Feed (triage first)</option>
          <option value="saved">Add straight to Saved</option>
        </select>
        <button className="btn" onClick={() => setParsed(parseImport(text))}>Preview</button>
        {parsed && parsed.rows.length > 0 && (
          <button
            className="btn"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await importRows(parsed.rows, target);
                setMsg(`Added ${r.added}, skipped ${r.duplicates} duplicate(s).`);
                setParsed(null);
                setText("");
              })
            }
          >
            Import {parsed.rows.length}
          </button>
        )}
      </div>
      {parsed && (
        <div className="rounded-sm border border-line p-2 text-xs">
          {parsed.rows.slice(0, 5).map((r, i) => (
            <div key={i} className="truncate text-text/90">
              {r.firm} · {r.role} {r.deadline ? `· closes ${r.deadline}` : ""}
            </div>
          ))}
          {parsed.rows.length > 5 && <div className="text-muted">…and {parsed.rows.length - 5} more</div>}
          {parsed.errors.slice(0, 4).map((e, i) => (
            <div key={i} className="text-magenta">{e}</div>
          ))}
        </div>
      )}
      {msg && <p className="text-xs text-teal">{msg}</p>}
    </div>
  );
}

function EmailPaste() {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Paste the body of an alert email here (text or HTML source)…" className="field !text-xs" />
      <button
        className="btn"
        disabled={pending || !text.trim()}
        onClick={() =>
          start(async () => {
            const r = await importEmailText(text, "feed");
            setMsg(r.found === 0 ? "Couldn't find any listings in that email. Send me a sample and I'll tune the parser." : `Found ${r.found}: added ${r.added}, ${r.duplicates} duplicate(s). e.g. ${r.preview.slice(0, 2).join("; ")}`);
          })
        }
      >
        Parse email
      </button>
      {msg && <p className="text-xs text-teal">{msg}</p>}
    </div>
  );
}

function Bookmarklet() {
  const ref = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState("");
  useEffect(() => {
    const c =
      "javascript:(function(){var d=document,m=function(n){var e=d.querySelector('meta[property=\"'+n+'\"],meta[name=\"'+n+'\"]');return e?e.content:''};" +
      "var s=String(window.getSelection?window.getSelection():'');" +
      "var p=new URLSearchParams({url:location.href,title:m('og:title')||d.title,site:m('og:site_name'),desc:(s||m('og:description')||m('description')).slice(0,1200)});" +
      `window.open('${location.origin}/opportunities?'+p.toString(),'_blank')})()`;
    // Set via the DOM: React refuses javascript: URLs in JSX.
    ref.current?.setAttribute("href", c);
    const t = setTimeout(() => setCode(c), 0);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="space-y-2">
      <a ref={ref} onClick={(e) => e.preventDefault()} draggable className="btn inline-block cursor-grab">
        + Send to Dashboard
      </a>
      <p className="text-xs">Drag that button onto your bookmarks bar. On any job page (including Trackr / Bright Network while logged in), select a bit of the description if you like, then click it. It opens this page with the details pre-filled. It only reads the tab you’re looking at, and nothing is sent anywhere until you press Save.</p>
      <button className="micro underline decoration-dotted" onClick={() => navigator.clipboard.writeText(code)}>Copy bookmarklet code</button>
    </div>
  );
}

export default function SourcesPanel({ info, onAdd }: { info: SourceInfo; onAdd: () => void }) {
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState<string[]>([]);
  const [origin, setOrigin] = useState("http://localhost:3000");
  useEffect(() => {
    const t = setTimeout(() => setOrigin(location.origin), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Step n={1} title="MANUAL + PASTE A LINK">
        <p>Paste a job link in the bar at the top and I’ll read the page’s title, description and (when the site publishes it) closing date. Sites that need a login (The Trackr, Bright Network, LinkedIn) are never fetched. You’ll get a blank form instead.</p>
        <button className="btn" onClick={onAdd}>Add by hand</button>
      </Step>

      <Step n={2} title="CSV / JSON IMPORT">
        <p>Export or copy a list from The Trackr, a spreadsheet, anywhere. Columns are matched by name (company, role, deadline, opens, link, status…), UK dates are understood, and re-importing never duplicates.</p>
        <ImportBox />
      </Step>

      <Step n={3} title="BROWSER BOOKMARKLET">
        <Bookmarklet />
      </Step>

      <Step n={4} title="EMAIL-FORWARD INGESTION">
        <p>Paste an alert email to parse it right now:</p>
        <EmailPaste />
        <div className="border-t border-line pt-3">
          <p>
            Automatic forwarding: have your mail rule / automation POST each alert to{" "}
            <code className="text-teal">{origin}/api/ingest/email</code> with header <code>Authorization: Bearer &lt;secret&gt;</code>. Status:{" "}
            <span className={info.ingestConfigured ? "text-teal" : "text-magenta"}>{info.ingestConfigured ? "INGEST_SECRET set" : "INGEST_SECRET not set"}</span>. That address only works when the sender can reach it (deployed site or a tunnel), so pasting is the no-setup route.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-sm border border-line p-2 text-[11px] text-text/80">{`curl -X POST ${origin}/api/ingest/email \\
  -H "Authorization: Bearer $INGEST_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"subject":"…","from":"alerts@…","html":"<html>…"}'`}</pre>
        </div>
      </Step>

      <Step n={5} title="WEB SEARCH, JOB APIS & CAREERS RSS">
        <p>
          Open-web search (Tavily API), the Adzuna API, and any careers RSS feeds you add in Settings. It also runs automatically whenever you open the app (if the last run was over 3h ago). Server-side only, cached (6h / 3h), robots.txt respected, with a daily call cap. Results go to the Feed.
        </p>
        <ul className="text-xs">
          <li>Adzuna: <span className={info.adzunaConfigured ? "text-teal" : "text-magenta"}>{info.adzunaConfigured ? "key configured" : "no key yet (add ADZUNA_APP_ID / ADZUNA_APP_KEY to .env.local)"}</span> · calls today {info.adzunaCallsToday}/{info.adzunaCap}</li>
          <li>Web search (Tavily): <span className={info.tavilyConfigured ? "text-teal" : "text-magenta"}>{info.tavilyConfigured ? "key configured" : "no key yet (add TAVILY_API_KEY to .env.local)"}</span> · credits today {info.tavilyCallsToday}/{info.tavilyCap}</li>
          <li>RSS feeds: {info.rssCount} configured</li>
          <li>Auto-refresh: {info.autoRefreshHours > 0 ? `every ${info.autoRefreshHours}h while the app is running` : "off"}</li>
          <li>Last refresh: {info.lastRefresh ? new Date(info.lastRefresh).toLocaleString("en-GB") : "never"}</li>
        </ul>
        <button
          className="btn"
          disabled={pending}
          onClick={() => start(async () => { const r = await refreshPublicSources(); setNotes([`Added ${r.added} new, ${r.duplicates} already known.`, ...r.notes]); })}
        >
          {pending ? "Fetching…" : "Refresh public sources"}
        </button>
        {notes.length > 0 && <ul className="space-y-0.5 text-xs">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
        <p className="text-[11px]">Web results link straight to the original page; Adzuna listings are credited with a “via Adzuna” link. Weights and feed URLs live in Settings.</p>
      </Step>
    </div>
  );
}
