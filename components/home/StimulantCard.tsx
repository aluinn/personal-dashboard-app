import Link from "next/link";
import { connection } from "next/server";
import Panel from "@/components/ui/Panel";
import QuickLog from "@/components/stimulants/QuickLog";
import { getStimSettings, stimLogsLastDays } from "@/lib/db/stimulants";
import { londonDate, londonToday } from "@/lib/time";

export default async function StimulantCard() {
  await connection();
  const today = londonToday();
  const logs = stimLogsLastDays(2).filter((l) => londonDate(l.at) === today);
  const caf = logs.filter((l) => l.kind === "caffeine");
  const mg = Math.round(caf.reduce((a, l) => a + l.mg, 0));
  const nic = logs.filter((l) => l.kind === "nicotine");
  const max = getStimSettings().maxMg;
  const last = caf[0] && new Date(caf[0].at).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
  return (
    <Panel label="STIMULANTS // TODAY" meta={<Link href="/stimulants" className="hover:text-teal">Open →</Link>} delay={0.15} className="md:col-span-3 xl:col-span-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="micro">Caffeine</div>
          <div className={`font-mono text-3xl font-light glow-text ${mg > max ? "text-magenta" : "text-teal"}`}>
            {mg}<span className="text-base text-muted"> / {max} mg</span>
          </div>
        </div>
        <div className="text-right">
          <div className="micro">Velo</div>
          <div className="font-mono text-2xl font-light">{nic.length}</div>
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full ${mg > max ? "bg-magenta" : "flow-gradient"}`} style={{ width: `${Math.min(100, (mg / max) * 100)}%` }} />
      </div>
      <div className="micro mt-2 normal-case tracking-wide">{last ? `Last caffeine ${last}` : "Nothing logged today"}</div>
      <div className="mt-3"><QuickLog only={["Coffee", "Velo"]} /></div>
    </Panel>
  );
}
