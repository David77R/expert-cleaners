import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import * as schema from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { brandOf, type Brand } from "@/domain/companies";
import { companyInputSchema, settingsFromInput } from "@/domain/company-form";
import { isOwner } from "@/domain/permissions";
import { createAgentSchema, type CreateAgentInput } from "@/domain/schemas";
import type { Db } from "@/server/appointments";
import { brandAssetsFromLogo, type BrandingStorage } from "@/server/branding";
import type { UserAdmin } from "@/server/user-admin";

const { companies, profiles, customers, technicians, appointments } = schema;

export type CityLocator = (city: string, state: string) => Promise<{ lat: number; lng: number } | null>;

export function assertOwner(actor: schema.Actor): void {
  if (!isOwner(actor)) throw new DomainError("forbidden", "Solo el dueño del sistema puede administrar empresas");
}

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

export async function companyBrand(db: Db, companyId: string): Promise<Brand> {
  const company = await findCompany(db, companyId);
  if (!company) throw new DomainError("not_found", "La empresa no existe");
  return brandOf(company);
}

async function requireCompany(db: Db, id: string): Promise<schema.Company> {
  const company = await findCompany(db, id);
  if (!company) throw new DomainError("not_found", "La empresa no existe");
  return company;
}

export type CompanyOverview = schema.Company & {
  people: number;
  customers: number;
  technicians: number;
  appointments: number;
};

export async function companyOverview(db: Db, actor: schema.Actor): Promise<CompanyOverview[]> {
  assertOwner(actor);
  const rows = await listCompanies(db);
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];
  const tally = async (table: typeof profiles | typeof customers | typeof technicians | typeof appointments) =>
    new Map(
      (
        await db
          .select({ companyId: table.companyId, total: count() })
          .from(table)
          .where(inArray(table.companyId, ids))
          .groupBy(table.companyId)
      ).map((row) => [row.companyId, Number(row.total)]),
    );
  const [people, customerCount, technicianCount, appointmentCount] = await Promise.all([
    tally(profiles),
    tally(customers),
    tally(technicians),
    tally(appointments),
  ]);
  return rows.map((row) => ({
    ...row,
    people: people.get(row.id) ?? 0,
    customers: customerCount.get(row.id) ?? 0,
    technicians: technicianCount.get(row.id) ?? 0,
    appointments: appointmentCount.get(row.id) ?? 0,
  }));
}

async function centerFor(
  input: { lat: number | null; lng: number | null; city: string; state: string },
  locate: CityLocator,
): Promise<{ lat: number; lng: number }> {
  if (input.lat !== null && input.lng !== null) return { lat: input.lat, lng: input.lng };
  const found = await locate(input.city, input.state);
  if (!found) {
    throw new DomainError(
      "city_not_found",
      "No encontramos esa ciudad en el mapa. Revisa el nombre o escribe la latitud y longitud.",
    );
  }
  return found;
}

async function assertSlugFree(db: Db, slug: string, excludeId?: string) {
  const [taken] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(excludeId ? and(eq(companies.slug, slug), ne(companies.id, excludeId)) : eq(companies.slug, slug))
    .limit(1);
  if (taken) throw new DomainError("slug_taken", `Ya existe una empresa con el identificador "${slug}"`);
}

export async function createCompany(db: Db, actor: schema.Actor, raw: unknown, locate: CityLocator) {
  assertOwner(actor);
  const input = companyInputSchema.parse(raw);
  await assertSlugFree(db, input.slug);
  const center = await centerFor(input, locate);
  const [created] = await db
    .insert(companies)
    .values({
      slug: input.slug,
      name: input.name,
      active: input.active,
      settings: settingsFromInput(input, center, null),
    })
    .returning();
  return created;
}

export async function updateCompany(db: Db, actor: schema.Actor, id: string, raw: unknown, locate: CityLocator) {
  assertOwner(actor);
  const current = await requireCompany(db, id);
  const input = companyInputSchema.parse({ ...(raw as object), slug: current.slug });
  const sameCity =
    input.city.toLowerCase() === current.settings.location.city.toLowerCase() &&
    input.state === current.settings.location.state;
  const previous = current.settings.location.center;
  const keptPrevious = input.lat === previous.lat && input.lng === previous.lng;
  const center =
    input.lat === null && input.lng === null && sameCity
      ? previous
      : !sameCity && keptPrevious
        ? await centerFor({ ...input, lat: null, lng: null }, locate)
        : await centerFor(input, locate);
  const [updated] = await db
    .update(companies)
    .set({ name: input.name, active: input.active, settings: settingsFromInput(input, center, current.settings) })
    .where(eq(companies.id, id))
    .returning();
  return updated;
}

export async function setCompanyLogo(
  db: Db,
  storage: BrandingStorage,
  actor: schema.Actor,
  id: string,
  bytes: Uint8Array,
  now: Date = new Date(),
) {
  assertOwner(actor);
  const current = await requireCompany(db, id);
  const background = current.settings.theme["--rail"] ?? current.settings.themeColor;
  const assets = await brandAssetsFromLogo(bytes, background);
  const folder = `${id}/${now.getTime()}`;
  const logoUrl = await storage.put(`${folder}/logo.webp`, assets.logo.bytes, "image/webp");
  let iconUrl = "";
  for (const icon of assets.icons) iconUrl = await storage.put(`${folder}/${icon.file}`, icon.bytes, "image/png");
  const icons = iconUrl.slice(0, iconUrl.lastIndexOf("/"));
  const [updated] = await db
    .update(companies)
    .set({
      settings: {
        ...current.settings,
        logo: { src: logoUrl, width: assets.logo.width, height: assets.logo.height },
        icons,
      },
    })
    .where(eq(companies.id, id))
    .returning();
  return updated;
}

export async function removeCompanyLogo(db: Db, actor: schema.Actor, id: string) {
  assertOwner(actor);
  const current = await requireCompany(db, id);
  const [updated] = await db
    .update(companies)
    .set({ settings: { ...current.settings, logo: null, icons: "/clients/default" } })
    .where(eq(companies.id, id))
    .returning();
  return updated;
}

export type CompanyPerson = { id: string; name: string; email: string; role: schema.UserRole; active: boolean };

export async function companyPeople(
  db: Db,
  auth: UserAdmin,
  actor: schema.Actor,
  id: string,
): Promise<CompanyPerson[]> {
  assertOwner(actor);
  await requireCompany(db, id);
  const [rows, accounts] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.companyId, id)).orderBy(asc(profiles.role), asc(profiles.name)),
    auth.listUsers(),
  ]);
  const emails = new Map(accounts.map((account) => [account.id, account.email]));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: emails.get(row.id) ?? "",
    role: row.role,
    active: row.active,
  }));
}

export async function createCompanyAdmin(
  db: Db,
  auth: UserAdmin,
  actor: schema.Actor,
  companyId: string,
  raw: CreateAgentInput,
) {
  assertOwner(actor);
  await requireCompany(db, companyId);
  const input = createAgentSchema.parse(raw);
  const account = await auth.createUser(input);
  try {
    const [profile] = await db
      .insert(profiles)
      .values({ id: account.id, companyId, name: input.name, role: "admin", active: true })
      .onConflictDoUpdate({ target: profiles.id, set: { companyId, name: input.name, role: "admin", active: true } })
      .returning();
    return profile;
  } catch (error) {
    await auth.deleteUser(account.id).catch(() => undefined);
    throw error;
  }
}
