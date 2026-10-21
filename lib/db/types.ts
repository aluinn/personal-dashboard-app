import type { assessments, modules, opportunities, sessions } from "./schema";

export type Module = typeof modules.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;

export type TimetableData = {
  modules: Module[];
  sessions: Session[];
  assessments: Assessment[];
};

export type Opportunity = typeof opportunities.$inferSelect;
