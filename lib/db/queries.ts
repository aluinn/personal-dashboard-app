import { connection } from "next/server";
import { asc } from "drizzle-orm";
import { db, schema } from "./index";
import type { TimetableData } from "./types";

// connection() makes this run per request instead of at build time.
export async function getTimetableData(): Promise<TimetableData> {
  await connection();
  return {
    modules: db.select().from(schema.modules).orderBy(asc(schema.modules.id)).all(),
    sessions: db.select().from(schema.sessions).orderBy(asc(schema.sessions.id)).all(),
    assessments: db
      .select()
      .from(schema.assessments)
      .orderBy(asc(schema.assessments.dueDate), asc(schema.assessments.dueTime))
      .all(),
  };
}
