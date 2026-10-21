import { Suspense } from "react";
import PageHeader from "@/components/ui/PageHeader";
import EventsView from "@/components/events/EventsView";
import { loadEvents } from "@/lib/events/load";

async function Data() {
  const data = await loadEvents();
  return <EventsView {...data} />;
}

export default function Page() {
  return (
    <>
      <PageHeader code="05 // TECH EVENTS" title="Tech Events" />
      <Suspense fallback={<div className="micro">Loading calendars…</div>}>
        <Data />
      </Suspense>
    </>
  );
}
