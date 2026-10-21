import { connection } from "next/server";
import { loadDone, recentDoneTexts } from "@/lib/db/life";
import { addDays, londonToday } from "@/lib/time";
import DoneCardClient from "./DoneCardClient";

export default async function DoneCard() {
  await connection();
  const today = londonToday();
  const [items, recent] = await Promise.all([loadDone(today), recentDoneTexts(addDays(today, -30))]);
  return <DoneCardClient items={items} suggestions={recent.map((r) => r.text)} />;
}
