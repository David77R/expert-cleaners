import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";
import type { Db } from "@/server/appointments";

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

export function getDb(): Db {
  if (!globalForDb.pgClient) {
    globalForDb.pgClient = postgres(env().DATABASE_URL, { prepare: false, max: 10 });
  }
  return drizzle(globalForDb.pgClient, { schema }) as unknown as Db;
}
