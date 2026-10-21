import { Suspense } from "react";
import PageHeader from "@/components/ui/PageHeader";
import TimetableView from "@/components/timetable/TimetableView";
import { getTimetableData } from "@/lib/db/queries";

async function Data() {
  const data = await getTimetableData();
  return <TimetableView {...data} />;
}

export default function Page() {
  return (
    <>
      <PageHeader code="02 // TIMETABLE" title="Timetable" />
      <Suspense fallback={<div className="micro">Loading schedule…</div>}>
        <Data />
      </Suspense>
    </>
  );
}
