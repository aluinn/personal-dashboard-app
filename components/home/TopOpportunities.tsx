import Link from "next/link";
import { connection } from "next/server";
import Panel from "@/components/ui/Panel";
import { getMatchConfig, listOpportunities } from "@/lib/db/opp";
import { scoreListing } from "@/lib/match";
import { timing } from "@/lib/opp";
import { londonToday } from "@/lib/time";

export default async function TopOpportunities() {
  await connection();
  const config = await getMatchConfig();
  const today = londonToday();
  const top = (await listOpportunities())
    .filter((o) => o.status === "feed" || o.status === "saved")
    .map((o) => ({ o, t: timing(o, today), m: scoreListing(o, config) }))
    .filter((x) => x.t.state === "open")
    .sort((a, b) => b.m.score - a.m.score)
    .slice(0, 3);

  return (
    <Panel label="TOP 3 // OPEN OPPORTUNITIES" meta={<Link href="/opportunities" className="hover:text-teal">View all →</Link>} delay={0.35} accent="violet" className="md:col-span-6 xl:col-span-8">
      {top.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing open and tracked yet. <Link href="/opportunities" className="text-teal underline decoration-dotted">Add or import some</Link>.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {top.map(({ o, t, m }) => (
            <li key={o.id} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="truncate text-sm">
                  {o.firm} <span className="text-muted">· {o.role}</span>
                </div>
                <div className="micro truncate normal-case tracking-wide">
                  {m.why}
                  {t.countdown ? ` · ${t.countdown}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="h-1 w-20 overflow-hidden rounded-full bg-white/5">
                  <div className="flow-gradient h-full" style={{ width: `${m.score}%` }} />
                </div>
                <span className="font-mono text-sm text-teal">{m.score}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
