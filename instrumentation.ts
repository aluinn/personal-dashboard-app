export async function register() {
  // Node only (not the edge runtime): the scheduler uses the local SQLite database.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/sources/scheduler");
    startScheduler();
  }
}
