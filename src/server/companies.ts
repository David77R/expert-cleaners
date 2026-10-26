import { asc, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Db } from "@/server/appointments";

const { companies } = schema;

export async function listCompanies(db: Db): Promise<schema.Company[]> {
  return db.select().from(companies).orderBy(asc(companies.name));
}

export async function findCompany(db: Db, id: string): Promise<schema.Company | null> {
  const [row] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return row ?? null;
}

export async function findCompanyBySlug(db: Db, slug: string): Promise<schema.Company | null> {
  const [row] = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
  return row ?? null;
}
