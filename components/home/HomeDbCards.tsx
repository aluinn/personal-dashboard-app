import { getTimetableData } from "@/lib/db/queries";
import DeadlinesCard from "./DeadlinesCard";
import TodayCard from "./TodayCard";

export async function TodayData() {
  const d = await getTimetableData();
  return <TodayCard modules={d.modules} sessions={d.sessions} />;
}

export async function DeadlinesData() {
  const d = await getTimetableData();
  return <DeadlinesCard modules={d.modules} assessments={d.assessments} />;
}
