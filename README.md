# Command Deck: personal dashboard

A single-user dashboard: readiness score, timetable, opportunities tracker, tech events, sleep, workouts,
stimulants, habits, goals and a weekly review. Next.js 16 (App Router) + TypeScript + Tailwind v4, with a
local SQLite database.

## Setup

You need [Node.js](https://nodejs.org) 20.9 or newer (`node -v` to check).

```bash
cd "Personal dashboard"
npm install
cp .env.local.example .env.local     # then fill in what you want (all optional, see below)
npm run dev                          # http://localhost:3000
```

Locally, your data lives in `data/dashboard.db` (created on first run). Back it up by copying that file while the
app is stopped. It is not in git. To use a hosted database instead, see "Deploying to Vercel".

For everyday use, a production build is faster and is what Lighthouse should be run against:

```bash
npm run build && npm start
```

## Environment variables (`.env.local`)

None are required. Secrets only ever go in this file, never in the app's forms.

| Variable | What it does |
| --- | --- |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Use a hosted Turso database instead of the local file (on Vercel, the Turso integration sets these for you). |
| `DASHBOARD_PASSWORD` | Password-protects every page (browser login prompt, any username). **Set this before exposing the app beyond your Mac;** on Vercel it's required once a database is connected. |
| `INGEST_SECRET` | Lets Health Auto Export / scripts POST to `/api/ingest/health` and `/api/ingest/email` (send `Authorization: Bearer <secret>`). Generate one with `openssl rand -hex 24`. |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Adzuna job search (free account at developer.adzuna.com). |
| `TAVILY_API_KEY` | Open-web opportunity search (free plan at app.tavily.com). |

## Importing Apple Health data

1. On your iPhone open **Health** → tap your **profile picture** → **Export All Health Data** → **Export**.
2. AirDrop the `export.zip` to your Mac (or Save to Files and open it on the Mac).
3. In the dashboard go to **Settings → Health data** and drop the zip onto the box.

Only sleep, heart rate, resting heart rate, HRV, steps, active energy and workouts are read. Re-importing is
safe (duplicates are skipped). Sleep stages need an Apple Watch with sleep tracking. For regular exports or
automatic sync from the Health Auto Export app, the Settings page walks through both. Without sleep/HRV/
workout data the readiness score is built from whatever exists, and shows "No score yet" if nothing does.

## Other data sources

- **Tech events:** Settings → Tech events. Paste each Luma calendar's iCal link ("Add iCal Subscription" on the
  calendar page, an `api.lu.ma/ics/get?…` URL). Any public `.ics` feed also works. Fetched server-side, cached 1 h.
- **Notes:** on the Notes page, upload each lecture as a PDF (in Notion: ••• → Export → PDF). The text is read
  out of the PDF and shown in the galaxy, search and reading view; the original PDF is kept and linked.
- **Opportunities:** add by hand, paste a link, import CSV/JSON, forward alert emails, or enable Adzuna / Tavily.
  Login-gated sites (The Trackr, Bright Network, LinkedIn) are deliberately never fetched.
- **Timetable:** edit modules and sessions in Settings; subscribe to `/api/timetable.ics` in Apple Calendar.

## Deploying to Vercel

**Just import the GitHub repo at [vercel.com/new](https://vercel.com/new) and deploy.** No environment variables are needed
for it to run. With nothing configured it starts in **demo mode** (a banner says so): everything works, but
Vercel's servers have no permanent disk, so what you add is lost when the server restarts.

**To keep your data (one click):** in the Vercel project open **Storage** → add **Turso** (Vercel's marketplace
integration creates the database and fills in `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for you) → **Redeploy**.
The demo banner disappears and everything is saved. The app creates all its tables on first load.

**Then add a password**, because the site is public on the internet and now holds your data. In Settings →
Environment Variables add `DASHBOARD_PASSWORD` (any value you like) and redeploy. Until you do, the site shows a
message instead of your data. You log in with any username and that password.

Optional variables: `INGEST_SECRET` (Health Auto Export sync), `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`, `TAVILY_API_KEY`.

If you'd rather create the database yourself: `turso db create dashboard`, then set `TURSO_DATABASE_URL`
(`turso db show dashboard --url`) and `TURSO_AUTH_TOKEN` (`turso db tokens create dashboard`). To copy local data
into it first: `sqlite3 data/dashboard.db .dump | turso db shell dashboard`.

What's different on Vercel:

- **Lecture PDFs** must be under 4 MB each (the hosting limit). Turn off images when exporting from Notion if needed.
- **Importing big health files:** uploads are capped at about 4.5 MB, so a full Apple Health `export.zip` can't be
  uploaded on the hosted site. Run the app **on your Mac pointed at the same database** and import there:
  ```bash
  TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run dev
  ```
  then use Settings → Health data as usual. Small CSV/JSON files and Health Auto Export sync
  (`/api/ingest/health`) work on the hosted site.
- **Opportunities** refresh when you open the app (and on "Refresh" in the Sources tab); there's no background timer on Vercel.
- **Install on your iPhone:** open the Vercel URL in Safari → Share → **Add to Home Screen**.

## Keyboard and quick actions

`⌘K` / `Ctrl+K` opens the palette: jump to any page, or quick-log a coffee, a Velo, a workout, or an application.

## Checks

```bash
npx tsc --noEmit && npx eslint app components lib && npm run build
```
