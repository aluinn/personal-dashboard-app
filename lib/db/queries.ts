import { connection } from "next/server";
import { asc } from "drizzle-orm";
import { db, schema } from "./index";
import type { TimetableData } from "./types";

// connection() makes this run per request instead of at build time.
export async function getTimetableData(): Promise<TimetableData> {
  await connection();
  const [modules, sessions, assessments] = await Promise.all([
    db.select().from(schema.modules).orderBy(asc(schema.modules.id)).all(),
    db.select().from(schema.sessions).orderBy(asc(schema.sessions.id)).all(),
    db.select().from(schema.assessments).orderBy(asc(schema.assessments.dueDate), asc(schema.assessments.dueTime)).all(),
  ]);
  return { modules, sessions, assessments };
}
