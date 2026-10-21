import { Suspense } from "react";
import PageHeader from "@/components/ui/PageHeader";
import SleepView from "@/components/sleep/SleepView";
import { getSleepPageData } from "@/lib/db/health";

async function Data() {
  const { rows, hr, hrv, target } = await getSleepPageData();
  return <SleepView rows={rows} hr={hr} hrv={hrv} target={target} />;
}

export default function Page() {
  return (
    <>
      <PageHeader code="06 // HEALTH / SLEEP" title="Sleep" />
      <Suspense fallback={<div className="micro">Loading sleep data…</div>}>
        <Data />
      </Suspense>
    </>
  );
}
