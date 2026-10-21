import { Suspense } from "react";
import PageHeader from "@/components/ui/PageHeader";
import OpportunitiesApp from "@/components/opportunities/OpportunitiesApp";
import { getOpportunitiesData } from "@/lib/db/opp";

async function Data() {
  const { items, config, sources } = await getOpportunitiesData();
  return <OpportunitiesApp items={items} config={config} sources={sources} />;
}

export default function Page() {
  return (
    <>
      <PageHeader code="04 // OPPORTUNITIES" title="Opportunities" />
      <Suspense fallback={<div className="micro">Loading pipeline…</div>}>
        <Data />
      </Suspense>
    </>
  );
}
