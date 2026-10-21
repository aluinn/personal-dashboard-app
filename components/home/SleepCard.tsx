import Link from "next/link";
import { connection } from "next/server";
import Panel from "@/components/ui/Panel";
import Stat from "@/components/ui/Stat";
import { getSleepTarget, loadSleepRows } from "@/lib/db/health";
import { buildNights, fmtHM, scoresFor } from "@/lib/sleep";

export default async function SleepCard() {
  await connection();
  const nights = buildNights(loadSleepRows());
  const wrap = "md:col-span-3 xl:col-span-4";
  if (nights.length === 0) {
    return (
      <Panel label="LATEST SLEEP" delay={0.1} className={wrap}>
        <p className="text-sm text-muted">
          No sleep data yet. <Link href="/settings" className="text-teal underline decoration-dotted">Import your Apple Health export</Link> or log a night on the Sleep page.
        </p>
      </Panel>
    );
  }
  const target = getSleepTarget();
  const scores = scoresFor(nights, target);
  const last = nights[nights.length - 1];
  const recent = nights.slice(-14);
  const max = Math.max(...recent.map((n) => n.asleepH), target);
  return (
    <Panel label="LATEST SLEEP" meta={<Link href="/health/sleep" className="hover:text-teal">Details →</Link>} delay={0.1} className={wrap}>
      <div className="flex items-end justify-between">
        <Stat label="Last night" value={last.asleepH} decimals={1} suffix="h" hint={`Score ${scores.get(last.date)} · ${last.hasStages ? `Deep ${fmtHM(last.deepH)} · REM ${fmtHM(last.remH)}` : "no stage data"}`} />
        <div className="flex h-12 items-end gap-[3px]" aria-label="Last 14 nights">
          {recent.map((n) => (
            <span key={n.date} className="w-1.5 bg-teal/60" style={{ height: `${(n.asleepH / max) * 100}%` }} title={`${n.date}: ${fmtHM(n.asleepH)}`} />
          ))}
        </div>
      </div>
    </Panel>
  );
}
