import "server-only";
import { refreshDue, runPublicRefresh } from "./refresh";
import { syncDue, syncNotes } from "@/lib/notion/sync";

// Background refresh while the server is running (`npm run dev` / `npm start`).
// Checks every 30 minutes and refreshes when the configured interval (Settings) has passed.
// Only official/public sources are polled. The Trackr and Bright Network are never fetched.
const g = globalThis as unknown as { __opp_scheduler?: boolean };

async function tick() {
  try {
    // Notion notes (read-only), on the interval set in Settings; does nothing without a token.
    if (await syncDue()) {
      const r = await syncNotes();
      console.log(`[notes] auto-sync: ${r.ok ? `${r.pages} pages (${r.fetched} changed)` : r.error}`);
    }
  } catch (e) {
    console.error("[notes] auto-sync failed:", (e as Error).message);
  }
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
