import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/** Return a cached payload younger than ttlMs, else run fn() and store its result. */
export async function fetchCached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<{ data: T; cached: boolean }> {
  const row = await db.select().from(schema.sourceCache).where(eq(schema.sourceCache.key, key)).get();
  if (row && Date.now() - row.fetchedAt < ttlMs) return { data: JSON.parse(row.payload) as T, cached: true };
  const data = await fn();
  await db.insert(schema.sourceCache)
    .values({ key, fetchedAt: Date.now(), payload: JSON.stringify(data) })
    .onConflictDoUpdate({ target: schema.sourceCache.key, set: { fetchedAt: Date.now(), payload: JSON.stringify(data) } })
    .run();
  return { data, cached: false };
}

const dayKey = (name: string) => `budget:${name}:${new Date().toISOString().slice(0, 10)}`;

export async function callsToday(name: string) {
  const row = await db.select().from(schema.sourceCache).where(eq(schema.sourceCache.key, dayKey(name))).get();
  return row ? Number(row.payload) : 0;
}

/** Daily call budget. Returns false (and spends nothing) once the cap is reached. */
export async function spendCall(name: string, cap: number) {
  const n = await callsToday(name);
  if (n >= cap) return false;
  await db.insert(schema.sourceCache)
    .values({ key: dayKey(name), fetchedAt: Date.now(), payload: String(n + 1) })
    .onConflictDoUpdate({ target: schema.sourceCache.key, set: { payload: String(n + 1), fetchedAt: Date.now() } })
    .run();
  return true;
}
