import { Suspense } from "react";
import PageHeader from "@/components/ui/PageHeader";
import NotesView from "@/components/notes/NotesView";
import { getNotesData } from "@/lib/db/notes";

async function Data() {
  const d = await getNotesData();
  return <NotesView {...d} />;
}

export default function Page() {
  return (
    <>
      <PageHeader code="03 // NOTES" title="Notes · Year 2 (2026-27)" />
      <Suspense fallback={<div className="micro">Loading notes…</div>}>
        <Data />
      </Suspense>
    </>
  );
}
