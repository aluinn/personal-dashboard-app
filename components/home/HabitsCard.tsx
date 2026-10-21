import Link from "next/link";
import { connection } from "next/server";
import Panel from "@/components/ui/Panel";
import HabitGrid from "@/components/life/HabitGrid";
import { loadHabits } from "@/lib/db/life";
import { addDays, londonToday } from "@/lib/time";

export default async function HabitsCard() {
  await connection();
  const today = londonToday();
  const habits = loadHabits(addDays(today, -60));
  return (
    <Panel label="HABITS // TODAY" meta={<Link href="/habits" className="hover:text-teal">Open →</Link>} delay={0.45} className="md:col-span-3 xl:col-span-4">
      <HabitGrid habits={habits} today={today} compact />
    </Panel>
  );
}
