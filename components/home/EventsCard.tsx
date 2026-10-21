import Link from "next/link";
import { connection } from "next/server";
import Panel from "@/components/ui/Panel";
import { loadEvents } from "@/lib/events/load";
import EventsCardClient from "./EventsCardClient";

export default async function EventsCard() {
  await connection();
  const { events, blocks, configured } = await loadEvents();
  if (!configured)
    return (
      <Panel label="NEXT 3 // TECH EVENTS" delay={0.4} className="md:col-span-6 xl:col-span-4">
        <p className="text-sm text-muted">
          No Luma calendars yet. <Link href="/events" className="text-teal underline decoration-dotted">See how to add some</Link>.
        </p>
      </Panel>
    );
  // Only what the card needs: the client picks the next 3 once it knows your Going / Interested marks.
  const slim = events.slice(0, 30).map(({ id, title, start, end, allDay, online, venue }) => ({ id, title, start, end, allDay, online, venue }));
  return <EventsCardClient events={slim} blocks={blocks} />;
}
