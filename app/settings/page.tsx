import Link from "next/link";
import { Suspense } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import { getTimetableData } from "@/lib/db/queries";
import { addEvent, deleteSession, updateModule, updateSession } from "@/app/actions";
import { DAY_NAMES } from "@/lib/time";
import { getMatchConfig, getSourceSettings } from "@/lib/db/opp";
import { saveEventFeeds } from "@/app/events/actions";
import { getEventFeedLines } from "@/lib/events/load";
import { saveProjectLinks } from "@/app/life-actions";
import { getProjectLinks } from "@/lib/db/life";
import { PROJECTS } from "@/lib/life";
import { saveNotionSettings, saveTermDatesAction } from "@/app/notes/actions";
import SyncButton from "@/components/notes/SyncButton";
import { getNotionStatus } from "@/lib/notion/sync";
import { getTermDates } from "@/lib/db/academic";
import { MODULE_TERMS, TERMS, YEAR_LABEL, CURRENT_YEAR } from "@/lib/academic";
import HealthImport from "@/components/settings/HealthImport";
import { db } from "@/lib/db";
import { resetMatchConfig, saveMatchConfig, saveSourceSettings } from "@/app/opportunities/actions";

async function Data() {
  const { modules, sessions } = await getTimetableData();
  const weekly = sessions.filter((s) => !s.date);
  const oneOff = sessions.filter((s) => s.date).sort((a, b) => a.date!.localeCompare(b.date!));
  const one = (sql: string) => db.$client.prepare(sql).get() as Record<string, number | string | null>;
  const healthCounts = {
    nights: Number(one("SELECT COUNT(*) n FROM sleep_sessions").n),
    hr: Number(one("SELECT COUNT(*) n FROM heart_rate_daily").n),
    hrv: Number(one("SELECT COUNT(*) n FROM hrv_daily").n),
    steps: Number(one("SELECT COUNT(*) n FROM steps_daily").n),
    workouts: Number(one("SELECT COUNT(*) n FROM workouts_imported").n),
    first: (one("SELECT MIN(night_date) d FROM sleep_sessions").d as string | null) ?? null,
    last: (one("SELECT MAX(night_date) d FROM sleep_sessions").d as string | null) ?? null,
  };
  const match = getMatchConfig();
  const src = getSourceSettings();
  const eventFeeds = getEventFeedLines();
  const projectLinks = getProjectLinks();
  const notion = getNotionStatus();
  const termDates = getTermDates();
  const modName = (id: number | null) => modules.find((m) => m.id === id)?.code ?? "—";

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel label="HEALTH DATA // IMPORT" className="xl:col-span-2" accent="violet">
        <HealthImport ingestConfigured={Boolean(process.env.INGEST_SECRET)} counts={healthCounts} />
      </Panel>

      <Panel label="NOTION // NOTES SYNC" className="xl:col-span-2" accent="violet">
        <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className={notion.tokenSet ? "text-teal" : "text-magenta"}>{notion.tokenSet ? "● NOTION_TOKEN is set" : "● NOTION_TOKEN not set (add it to .env.local, then restart)"}</span>
          {notion.last && <span className="micro normal-case tracking-wide">Last sync {new Date(notion.last.at).toLocaleString("en-GB", { timeZone: "Europe/London" })}: {notion.last.ok ? `${notion.last.pages} pages` : notion.last.error}</span>}
        </div>
        <p className="mb-3 text-xs text-muted">
          The token is a secret, so it lives in <code>.env.local</code> and never in a form. Everything else is here. Use <b>either</b> a database below
          <b> or</b> a Notion URL on each module (Modules panel). The setup steps are on the <Link href="/notes" className="text-teal underline decoration-dotted">Notes</Link> page.
        </p>
        <form action={saveNotionSettings} className="grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end">
          <label className="space-y-1"><span className="micro">Notes database URL or ID (optional)</span><input name="database" defaultValue={notion.database} placeholder="https://www.notion.so/…" className="field" /></label>
          <label className="space-y-1"><span className="micro">Auto-sync every (hours, 0 = off)</span><input name="hours" type="number" min={0} max={72} defaultValue={notion.hours} className="field" /></label>
          <button className="btn">Save</button>
        </form>
        <div className="mt-4 border-t border-line pt-3"><SyncButton disabled={!notion.tokenSet} /></div>
      </Panel>

      <Panel label={`TERM DATES // YEAR ${CURRENT_YEAR} (${YEAR_LABEL[CURRENT_YEAR]})`} className="xl:col-span-2">
        <p className="mb-3 text-xs text-muted">Used to tag notes and deadlines with a term and to number teaching weeks. These defaults are approximate, so check them against UCL’s calendar.</p>
        <form action={saveTermDatesAction} className="grid gap-3 md:grid-cols-[repeat(3,1fr)_auto] md:items-end">
          {TERMS.map((t) => (
            <fieldset key={t} className="space-y-1">
              <legend className="micro">{t}</legend>
              <div className="flex gap-2">
                <input name={`start_${t}`} type="date" defaultValue={termDates[t].start} className="field" aria-label={`${t} start`} />
                <input name={`end_${t}`} type="date" defaultValue={termDates[t].end} className="field" aria-label={`${t} end`} />
              </div>
            </fieldset>
          ))}
          <button className="btn">Save dates</button>
        </form>
      </Panel>

      <Panel label="MODULES // NOTION LINKS & COLOURS" className="xl:col-span-2">
        <div className="space-y-4">
          {modules.map((m) => (
            <form key={m.id} action={updateModule} className="grid items-end gap-2 md:grid-cols-[110px_1fr_1.4fr_1fr_110px_50px_auto]">
              <input type="hidden" name="id" value={m.id} />
              <div>
                <div className="micro" style={{ color: m.color }}>{m.code}</div>
              </div>
              <label className="space-y-1">
                <span className="micro">Name</span>
                <input name="name" defaultValue={m.name} className="field" />
              </label>
              <label className="space-y-1">
                <span className="micro">Notion notes URL</span>
                <input name="notionUrl" type="url" defaultValue={m.notionUrl} placeholder="https://www.notion.so/…" className="field" />
              </label>
              <label className="space-y-1">
                <span className="micro">Lecturer</span>
                <input name="lecturer" defaultValue={m.lecturer} className="field" />
              </label>
              <label className="space-y-1">
                <span className="micro">Year {m.year} term</span>
                <select name="term" defaultValue={m.term} className="field">
                  {MODULE_TERMS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <input name="color" type="color" defaultValue={m.color} aria-label="Accent colour" className="h-8 w-full cursor-pointer bg-transparent" />
              <button className="btn">Save</button>
            </form>
          ))}
        </div>
      </Panel>

      <Panel label="WEEKLY SESSIONS // ROOM · LECTURER · LOCATION">
        <div className="space-y-4">
          {weekly.map((s) => (
            <form key={s.id} action={updateSession} className="grid items-end gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
              <input type="hidden" name="id" value={s.id} />
              <div className="col-span-full text-sm">
                <span className="font-mono text-teal">{DAY_NAMES[s.weekday ?? 0]} {s.startTime}–{s.endTime}</span>{" "}
                <span className="text-muted">{s.title}</span>
              </div>
              <input name="room" defaultValue={s.room} placeholder="Room" className="field" />
              <input name="lecturer" defaultValue={s.lecturer} placeholder="Lecturer" className="field" />
              <input name="location" defaultValue={s.location} placeholder="Building / address" className="field" />
              <button className="btn">Save</button>
            </form>
          ))}
        </div>
      </Panel>

      <Panel label="ADD ONE-OFF EVENT // EXAM · DEADLINE · EVENT">
        <form action={addEvent} className="grid grid-cols-2 gap-2">
          <input name="title" required placeholder="Title" className="field col-span-2" />
          <select name="kind" className="field">
            <option value="event">Event</option>
            <option value="exam">Exam</option>
            <option value="deadline">Deadline</option>
          </select>
          <select name="moduleId" className="field">
            <option value="0">No module</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.code}</option>
            ))}
          </select>
          <input name="date" type="date" required className="field" />
          <div className="grid grid-cols-2 gap-2">
            <input name="startTime" type="time" required className="field" />
            <input name="endTime" type="time" className="field" />
          </div>
          <input name="room" placeholder="Room" className="field" />
          <input name="location" placeholder="Location" className="field" />
          <button className="btn col-span-2">Add event</button>
        </form>

        {oneOff.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-line pt-3">
            {oneOff.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-mono text-teal">{s.date} {s.startTime}</span> {s.title}{" "}
                  <span className="micro">{modName(s.moduleId)} · {s.kind}</span>
                </span>
                <form action={deleteSession}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="micro hover:text-magenta">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel label="CV MATCHING // WEIGHTS & KEYWORDS" className="xl:col-span-2" accent="violet">
        <p className="mb-3 text-sm text-muted">
          Each group’s weight (0-10) sets how much a hit in that group lifts a listing’s score. Keywords found in the role title count double.
          Short ALL-CAPS keywords (AI, FX, CRM) match exactly; others ignore case and plurals. Defaults come from your profile in <code>lib/profile.ts</code>.
        </p>
        <form action={saveMatchConfig} className="space-y-4">
          {match.groups.map((g) => (
            <div key={g.key} className="grid gap-2 md:grid-cols-[200px_90px_1fr] md:items-start">
              <div className="micro pt-2 text-text">{g.label}</div>
              <label className="space-y-1">
                <span className="micro">Weight</span>
                <input name={`w_${g.key}`} type="number" min={0} max={10} step={0.5} defaultValue={g.weight} className="field" />
              </label>
              <label className="space-y-1">
                <span className="micro">Keywords (comma or line separated)</span>
                <textarea name={`k_${g.key}`} rows={3} defaultValue={g.keywords.join(", ")} className="field font-mono !text-xs" />
              </label>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button className="btn">Save weights</button>
          </div>
        </form>
        <form action={resetMatchConfig} className="mt-2">
          <button className="micro underline decoration-dotted hover:text-magenta">Reset to profile defaults</button>
        </form>
      </Panel>

      <Panel label="PUBLIC SOURCES // WEB SEARCH, ADZUNA & CAREERS RSS" className="xl:col-span-2">
        <form action={saveSourceSettings} className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="micro">Adzuna searches (one per line)</span>
            <textarea name="adzunaQueries" rows={5} defaultValue={src.adzunaQueries.join("\n")} className="field" />
          </label>
          <label className="space-y-1">
            <span className="micro">Careers RSS/Atom feed URLs (space or line separated)</span>
            <textarea name="rssFeeds" rows={5} defaultValue={src.rssFeeds.join("\n")} placeholder="https://…/careers.rss" className="field" />
          </label>
          <label className="space-y-1 md:col-span-3">
            <span className="micro">Open-web searches via Tavily (one per line; each costs 1 credit)</span>
            <textarea name="webQueries" rows={6} defaultValue={src.webQueries.join("\n")} className="field" />
          </label>
          <div className="space-y-3">
            <label className="space-y-1">
              <span className="micro">Auto-refresh every (hours, 0 = off)</span>
              <input name="autoRefreshHours" type="number" min={0} max={168} defaultValue={src.autoRefreshHours} className="field" />
            </label>
            <label className="space-y-1">
              <span className="micro">Tavily daily credit cap (free plan: 1,000/month)</span>
              <input name="tavilyCap" type="number" min={1} max={100} defaultValue={src.tavilyCap} className="field" />
            </label>
            <label className="space-y-1">
              <span className="micro">Adzuna daily call cap</span>
              <input name="adzunaCap" type="number" min={1} max={100} defaultValue={src.adzunaCap} className="field" />
            </label>
            <p className="text-xs text-muted">
              Keys go in <code>.env.local</code> (never in this form): <code>TAVILY_API_KEY</code>, <code>ADZUNA_APP_ID</code>, <code>ADZUNA_APP_KEY</code>, <code>INGEST_SECRET</code>.
              Free Adzuna accounts show their own limits in your account; keep the cap under them.
            </p>
            <button className="btn">Save sources</button>
          </div>
        </form>
      </Panel>

      <Panel label="TECH EVENTS // LUMA CALENDARS & ICS FEEDS" className="xl:col-span-2" accent="violet">
        <form action={saveEventFeeds} className="space-y-3">
          <label className="block space-y-1">
            <span className="micro">One per line: Name | link | topics (optional: ai, crypto, startups, hackathons, fintech)</span>
            <textarea
              name="eventFeeds"
              rows={5}
              defaultValue={eventFeeds.join("\n")}
              placeholder={"London AI | https://api.lu.ma/ics/get?entity=calendar&id=cal-… | ai\nSolana UK | webcal://… | crypto"}
              className="field font-mono !text-xs"
            />
          </label>
          <p className="text-xs text-muted">
            On a Luma calendar’s page, click <span className="text-text">Add iCal Subscription</span> and copy the <code>api.lu.ma/ics/get</code> link
            (a bare <code>cal-…</code> id also works). Any public .ics feed is fine. Feeds are fetched on the server and cached for an hour. This
            only reads public subscription feeds: no login, no scraping of web pages.
          </p>
          <button className="btn">Save feeds</button>
        </form>
      </Panel>

      <Panel label="PROJECTS // QUICK LINKS" className="xl:col-span-2">
        <form action={saveProjectLinks} className="grid gap-3 md:grid-cols-3">
          {PROJECTS.map((p) => (
            <label key={p.key} className="space-y-1">
              <span className="micro">{p.name}: one per line, Label | https://…</span>
              <textarea
                name={`links_${p.key}`}
                rows={4}
                defaultValue={projectLinks[p.key].map((l) => `${l.label} | ${l.url}`).join("\n")}
                placeholder={"Site | https://…\nRepo | https://github.com/…"}
                className="field font-mono !text-xs"
              />
            </label>
          ))}
          <div className="md:col-span-3"><button className="btn">Save links</button></div>
        </form>
      </Panel>

      <Panel label="CALENDAR EXPORT" className="xl:col-span-2">
        <p className="mb-3 text-sm text-muted">
          Download once, or subscribe so Apple Calendar keeps itself up to date (it re-checks hourly). Subscribing works
          while this app is running on your Mac.
        </p>
        <div className="flex gap-2">
          <a href="/api/timetable.ics?download=1" className="btn">Download .ics</a>
        </div>
      </Panel>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader code="09 // SETTINGS" title="Settings & Data Import" />
      <Suspense fallback={<div className="micro">Loading…</div>}>
        <Data />
      </Suspense>
    </>
  );
}
