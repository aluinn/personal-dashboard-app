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

Your data lives in `data/dashboard.db` (created on first run). Back it up by copying that file while the
app is stopped. It is not in git and is never uploaded anywhere.

For everyday use, a production build is faster and is what Lighthouse should be run against:

```bash
npm run build && npm start
```

## Environment variables (`.env.local`)

None are required. Secrets only ever go in this file, never in the app's forms.

| Variable | What it does |
| --- | --- |
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

## Using it on your iPhone (PWA)

The app is installable: Safari → Share → **Add to Home Screen**. It then opens full-screen with its own icon.
The phone has to be able to reach the app, which is the part that needs a decision:

- **Same Wi-Fi, Mac running:** start it with `npm run build && npm start -- -H 0.0.0.0` and open
  `http://<your-mac-ip>:3000` on the phone. Set `DASHBOARD_PASSWORD` first.
- **From anywhere:** put a secure tunnel in front of your Mac (Tailscale, or a Cloudflare Tunnel) and use that
  `https://` address.
- **Hosting it (e.g. Vercel):** SQLite writes to a local file, which doesn't persist on Vercel. You'd need to move
  the database to a hosted one such as Turso first.

The service worker only provides installability and an offline message. It caches no data. Notifications fire
while the app is open (a tab or the installed app); true background push when it is closed isn't built.

## Keyboard and quick actions

`⌘K` / `Ctrl+K` opens the palette: jump to any page, or quick-log a coffee, a Velo, a workout, or an application.

## Checks

```bash
npx tsc --noEmit && npx eslint app components lib && npm run build
```
