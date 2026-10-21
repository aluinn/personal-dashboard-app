import Link from "next/link";
import { connection } from "next/server";
import Panel from "@/components/ui/Panel";
import CountUp from "@/components/ui/CountUp";
import ReadinessLoader from "@/components/hero/ReadinessLoader";
import { profile } from "@/lib/profile";
import { getReadiness } from "@/lib/db/readiness";

const LABEL: Record<string, string> = { sleep: "sleep", hrv: "HRV", load: "training load" };

export default async function ReadinessHero() {
  await connection();
  const r = await getReadiness();
  const trend = r.delta === null ? null : r.delta === 0 ? "same as yesterday" : `${r.delta > 0 ? "+" : ""}${r.delta} vs yesterday`;
  return (
    <Panel label="READINESS // TODAY" meta={r.score === null ? "NO DATA" : "LIVE"} accent="violet" className="min-h-[420px] md:col-span-6 xl:col-span-8 xl:row-span-3">
      <div className="absolute inset-0 top-10">
        <ReadinessLoader score={r.score} />
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4">
        <div className="micro text-teal/80">Good day,</div>
        <div className="text-3xl font-light tracking-wide">{profile.name}</div>
        <div className="micro mt-1">{profile.university.name} · {profile.university.degree}</div>
      </div>
      <div className="absolute right-4 top-12 w-52 text-right">
        <div className="micro">Readiness</div>
        {r.score === null ? (
          <div className="font-mono text-2xl font-light text-muted">No score yet</div>
        ) : (
          <div className="font-mono text-6xl font-light text-teal glow-text"><CountUp to={r.score} /></div>
        )}
        {trend && <div className="micro normal-case tracking-wide">{trend}</div>}
        <ul className="mt-3 space-y-1.5 text-left">
          {r.parts.map((p) => (
            <li key={p.key} title={p.detail}>
              <div className="micro flex justify-between !text-[9px]"><span>{LABEL[p.key]}</span><span className="text-text">{p.value}</span></div>
              <div className="h-[3px] overflow-hidden rounded-full bg-white/5"><div className="flow-gradient h-full" style={{ width: `${p.value}%` }} /></div>
            </li>
          ))}
        </ul>
        {r.missing.length > 0 && (
          <p className="micro mt-2 normal-case tracking-wide !text-[9px]">
            {r.score === null ? "Needs " : "Not counted: "}{r.missing.map((m) => LABEL[m]).join(", ")}.{" "}
            <Link href="/settings" className="pointer-events-auto text-teal underline decoration-dotted">Import data</Link>
          </p>
        )}
      </div>
    </Panel>
  );
}
