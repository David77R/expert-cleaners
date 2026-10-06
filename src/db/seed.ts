import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { seedBase } from "./seed-data";
import type { Db } from "@/server/appointments";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL es requerida");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema }) as unknown as Db;
  await seedBase(db);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
