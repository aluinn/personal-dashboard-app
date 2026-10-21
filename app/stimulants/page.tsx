import { Suspense } from "react";
import { connection } from "next/server";
import PageHeader from "@/components/ui/PageHeader";
import StimulantsView from "@/components/stimulants/StimulantsView";
import { getStimSettings, stimLogsLastDays, wakeTimeToday } from "@/lib/db/stimulants";

async function Data() {
  await connection();
  return <StimulantsView logs={stimLogsLastDays(15)} settings={getStimSettings()} wakeAt={wakeTimeToday()} />;
}

export default function Page() {
  return (
    <>
      <PageHeader code="08 // STIMULANTS" title="Stimulants" />
      <Suspense fallback={<div className="micro">Loading…</div>}>
        <Data />
      </Suspense>
    </>
  );
}
