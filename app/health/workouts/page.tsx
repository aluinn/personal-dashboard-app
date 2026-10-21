import { Suspense } from "react";
import PageHeader from "@/components/ui/PageHeader";
import WorkoutsView from "@/components/workouts/WorkoutsView";
import { getWorkoutsPageData } from "@/lib/db/workouts";

async function Data() {
  const d = await getWorkoutsPageData();
  return <WorkoutsView {...d} />;
}

export default function Page() {
  return (
    <>
      <PageHeader code="07 // HEALTH / WORKOUTS" title="Workouts" />
      <Suspense fallback={<div className="micro">Loading workouts…</div>}>
        <Data />
      </Suspense>
    </>
  );
}
