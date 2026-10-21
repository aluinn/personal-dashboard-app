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
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Use a hosted Turso database instead of the local file (needed on Vercel). |
| `DASHBOARD_PASSWORD` | Password-protects every page (browser login prompt, any username). **Set this before exposing the app beyond your Mac.** |
| `INGEST_SECRET` | Lets Health Auto Export / scripts POST to `/api/ingest/health` and `/api/ingest/email` (send `Authorization: Bearer <secret>`). Generate one with `openssl rand -hex 24`. |
| `CRON_SECRET` | Protects `/api/cron/refresh` on a hosted deployment. |
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
- **Opportunities:** add by hand, paste a link, import CSV/JSON, forward alert emails, or enable Adzuna / Tavily.
  Login-gated sites (The Trackr, Bright Network, LinkedIn) are deliberately never fetched.
- **Timetable:** edit modules and sessions in Settings; subscribe to `/api/timetable.ics` in Apple Calendar.

## Deploying to Vercel (so it works from anywhere, including your phone)

Vercel has no persistent disk, so on Vercel the data lives in **Turso** (a hosted SQLite, free tier). The app
picks the database from the environment: with `TURSO_DATABASE_URL` set it uses Turso, otherwise the local
`data/dashboard.db` file.

1. **Create the database** at [turso.tech](https://turso.tech) (sign in with GitHub). Install the CLI
   (`brew install tursodatabase/tap/turso`), then:
   ```bash
   turso auth login
   turso db create dashboard
   turso db show dashboard --url          # -> TURSO_DATABASE_URL  (libsql://...)
   turso db tokens create dashboard       # -> TURSO_AUTH_TOKEN
   ```
2. **(Optional) copy your existing local data into it**, *before* you first open the deployed app:
   ```bash
   sqlite3 data/dashboard.db .dump | turso db shell dashboard
   ```
3. **Import the repo** at [vercel.com/new](https://vercel.com/new) (pick `personal-dashboard-app`; framework
   "Next.js" is detected). Before deploying, add these **Environment Variables**:

   | Variable | Value |
   | --- | --- |
   | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | from step 1 |
   | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Use a hosted Turso database instead of the local file (needed on Vercel). |
| `DASHBOARD_PASSWORD` | **required.** Without it the hosted site refuses to serve anything. |
   | `CRON_SECRET` | a long random string (`openssl rand -hex 24`). Vercel sends it to the daily cron. |
   | `INGEST_SECRET` | only if you use Health Auto Export automatic sync |
   | `NOTION_TOKEN` | to sync notes (see the Notes page for the setup guide) |
   | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `TAVILY_API_KEY` | optional opportunity sources |

4. **Deploy**, open the URL, log in (any username, your `DASHBOARD_PASSWORD`).

What's different on Vercel:

- **Background refresh** (opportunities + Notion notes) runs from a once-a-day Vercel Cron
  (`vercel.json` → `/api/cron/refresh`) instead of the in-app timer. Use "Sync now" for an instant refresh.
- **Importing big health files:** serverless uploads are capped at about 4.5 MB, so a full Apple Health
  `export.zip` can't be uploaded on the hosted site. Run the app **on your Mac pointed at the same cloud
  database** and import there:
  ```bash
  TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run dev
  ```
  then use Settings → Health data as usual. The data lands in Turso and shows up on Vercel. Small CSV/JSON files
  and Health Auto Export automatic sync (`/api/ingest/health`) work fine on the hosted site.
- **Install on your iPhone:** open the Vercel URL in Safari → Share → **Add to Home Screen**.
- The same environment variables work locally if you want `npm run dev` to use the cloud database.

## Keyboard and quick actions

`⌘K` / `Ctrl+K` opens the palette: jump to any page, or quick-log a coffee, a Velo, a workout, or an application.

## Checks

```bash
npx tsc --noEmit && npx eslint app components lib && npm run build
```
