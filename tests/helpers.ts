import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import { seedBase } from "@/db/seed-data";
import type { Db } from "@/server/appointments";

export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  const base = await seedBase(db as unknown as Db);
  return { db: db as unknown as Db, client, ...base };
}

export function appointmentInput(
  base: Awaited<ReturnType<typeof createTestDb>>,
  overrides: Record<string, unknown> = {},
) {
  return {
    customerId: base.customer.id,
    addressId: base.address.id,
    serviceId: base.services.sofa.id,
    technicianId: base.techs[0].id,
    date: "2026-10-12",
    startMin: 540,
    durationMin: 60,
    specs: { sofaType: "Tela", seats: 3 },
    ...overrides,
  };
}
