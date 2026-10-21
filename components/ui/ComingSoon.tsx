import Panel from "./Panel";
import PageHeader from "./PageHeader";

export default function ComingSoon({ code, title }: { code: string; title: string }) {
  return (
    <>
      <PageHeader code={code} title={title} />
      <Panel label="STATUS" className="max-w-xl">
        <p className="text-sm text-muted">
          This module is scheduled for a later build phase. The route, layout and
          design system are already wired up.
        </p>
      </Panel>
    </>
  );
}
