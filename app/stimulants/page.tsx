import { Suspense } from "react";
import { connection } from "next/server";
import PageHeader from "@/components/ui/PageHeader";
import StimulantsView from "@/components/stimulants/StimulantsView";
import { getStimSettings, stimLogsLastDays, wakeTimeToday } from "@/lib/db/stimulants";

async function Data() {
  await connection();
  const [logs, settings, wakeAt] = await Promise.all([stimLogsLastDays(15), getStimSettings(), wakeTimeToday()]);
  return <StimulantsView logs={logs} settings={settings} wakeAt={wakeAt} />;
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
