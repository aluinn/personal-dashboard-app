import { connection } from "next/server";
import Link from "next/link";
import Panel from "@/components/ui/Panel";
import { getProjectLinks } from "@/lib/db/life";
import { PROJECTS } from "@/lib/life";

export default async function ProjectsCard() {
  await connection();
  const links = await getProjectLinks();
  const anyLinks = Object.values(links).some((l) => l.length);
  return (
    <Panel label="PROJECTS" meta={<Link href="/settings" className="hover:text-teal">Edit links →</Link>} delay={0.5} accent="violet" className="md:col-span-3 xl:col-span-4">
      <ul className="space-y-3">
        {PROJECTS.map((p) => (
          <li key={p.key}>
            <div className="text-sm">{p.name} <span className="text-xs text-muted">· {p.note}</span></div>
            <div className="mt-1 flex flex-wrap gap-2">
              {links[p.key].map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="micro rounded-sm border border-line px-2 py-1 hover:border-teal/50 hover:text-teal">{l.label} ↗</a>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {!anyLinks && <p className="micro mt-3 normal-case tracking-wide !text-[10px]">Add quick links in Settings → Projects.</p>}
    </Panel>
  );
}
