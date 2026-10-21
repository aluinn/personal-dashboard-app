import { connection } from "next/server";
import { getNotifications } from "@/lib/db/notifications";
import { loadEvents } from "@/lib/events/load";

export async function GET(req: Request) {
  await connection();
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return new Response("Forbidden", { status: 403 });
  const now = Date.now();
  const items = await getNotifications(now);
  // Events in the next 36h; the browser filters them to the ones you marked Going (marks live in the browser).
  let events: { id: string; title: string; start: number; venue: string; online: boolean }[] = [];
  try {
    events = (await loadEvents()).events
      .filter((e) => e.start > now && e.start < now + 36 * 3600_000)
      .map(({ id, title, start, venue, online }) => ({ id, title, start, venue, online }));
  } catch {
    /* feeds are optional */
  }
  return Response.json({ items, events, now });
}
