import Panel from "@/components/ui/Panel";
import { Suspense, type ReactNode } from "react";
import { DeadlinesData, TodayData } from "@/components/home/HomeDbCards";
import TopOpportunities from "@/components/home/TopOpportunities";
import EventsCard from "@/components/home/EventsCard";
import SleepCard from "@/components/home/SleepCard";
import WorkoutCard from "@/components/home/WorkoutCard";
import ReadinessHero from "@/components/home/ReadinessHero";
import TodayBrief from "@/components/home/TodayBrief";
import StimulantCard from "@/components/home/StimulantCard";
import HabitsCard from "@/components/home/HabitsCard";
import ProjectsCard from "@/components/home/ProjectsCard";
import GalaxyCard from "@/components/home/GalaxyCard";
import DoneCard from "@/components/home/DoneCard";
import GoalsCard from "@/components/home/GoalsCard";

const Slot = ({ label, className, children }: { label: string; className: string; children: ReactNode }) => (
  <Suspense fallback={<Panel label={label} className={className}><div className="micro">Loading…</div></Panel>}>{children}</Suspense>
);

export default function Home() {
  return (
    <div className="grid auto-rows-[minmax(120px,auto)] grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12">
      <Slot label="READINESS // TODAY" className="min-h-[420px] md:col-span-6 xl:col-span-8 xl:row-span-3"><ReadinessHero /></Slot>
      <Slot label="TODAY // BRIEF" className="md:col-span-6 xl:col-span-4"><TodayBrief /></Slot>
      <Slot label="LATEST SLEEP" className="md:col-span-3 xl:col-span-4"><SleepCard /></Slot>
      <Slot label="STIMULANTS // TODAY" className="md:col-span-3 xl:col-span-4"><StimulantCard /></Slot>

      <Slot label="DONE TODAY" className="md:col-span-6 xl:col-span-12"><DoneCard /></Slot>

      <Slot label="TODAY // TIMETABLE" className="md:col-span-3 xl:col-span-4"><TodayData /></Slot>
      <Slot label="NEXT DEADLINES" className="md:col-span-3 xl:col-span-4"><DeadlinesData /></Slot>
      <Slot label="WORKOUTS" className="md:col-span-3 xl:col-span-4"><WorkoutCard /></Slot>

      <Slot label="TOP 3 // OPEN OPPORTUNITIES" className="md:col-span-6 xl:col-span-8"><TopOpportunities /></Slot>
      <Slot label="NEXT 3 // TECH EVENTS" className="md:col-span-6 xl:col-span-4"><EventsCard /></Slot>

      <Slot label="KNOWLEDGE GALAXY" className="md:col-span-6 xl:col-span-12"><GalaxyCard /></Slot>

      <Slot label="HABITS // TODAY" className="md:col-span-3 xl:col-span-4"><HabitsCard /></Slot>
      <Slot label="PROJECTS" className="md:col-span-3 xl:col-span-4"><ProjectsCard /></Slot>
      <Slot label="GOALS" className="md:col-span-6 xl:col-span-4"><GoalsCard /></Slot>
    </div>
  );
}
