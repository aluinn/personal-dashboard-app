export async function register() {
  // Node only (not the edge runtime): the scheduler uses the local SQLite database.
  // Not on Vercel: serverless functions don't stay alive, so a timer would never fire. There, vercel.json
  // crons call /api/cron/refresh instead.
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    const { startScheduler } = await import("./lib/sources/scheduler");
    startScheduler();
  }
}
