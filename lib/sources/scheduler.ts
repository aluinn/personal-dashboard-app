import "server-only";
import { refreshDue, runPublicRefresh } from "./refresh";

// Background refresh while the server is running (`npm run dev` / `npm start`).
// Checks every 30 minutes and refreshes when the configured interval (Settings) has passed.
// Only official/public sources are polled. The Trackr and Bright Network are never fetched.
const g = globalThis as unknown as { __opp_scheduler?: boolean };

async function tick() {
  try {

    if (!(await refreshDue())) return;
    const r = await runPublicRefresh();
    console.log(`[opportunities] auto-refresh: +${r.added} new, ${r.duplicates} known. ${r.notes.join(" | ")}`);
  } catch (e) {
    console.error("[opportunities] auto-refresh failed:", (e as Error).message);
  }
}

export function startScheduler() {
  if (g.__opp_scheduler) return; // one timer per process, even across hot reloads
  g.__opp_scheduler = true;
  setTimeout(tick, 30_000).unref?.();
  setInterval(tick, 30 * 60_000).unref?.();
}
