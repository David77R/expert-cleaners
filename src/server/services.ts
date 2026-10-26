import { and, asc, count, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { assertAdmin, isAdmin } from "@/domain/permissions";
import { SLUG_PATTERN, isRetiredSlug, retiredSlug, slugify } from "@/domain/service-rules";
import { createServiceSchema, serviceListSchema, updateServiceSchema, type CreateServiceInput } from "@/domain/schemas";
import type { Db } from "@/server/appointments";

type Actor = schema.Actor;

const { services, appointments, appointmentItems } = schema;

function inCompany(companyId: string, id: string) {
  return and(eq(services.id, id), eq(services.companyId, companyId));
}

async function requireService(db: Db, companyId: string, id: string): Promise<schema.Service> {
  const [row] = await db.select().from(services).where(inCompany(companyId, id)).limit(1);
  if (!row || isRetiredSlug(row.slug)) throw new DomainError("not_found", "El servicio no existe");
  return row;
}

export async function listServices(db: Db, companyId: string, raw: unknown = {}, actor?: Actor) {
  const { includeInactive } = serviceListSchema.parse(raw);
  const rows = (
    await db
      .select()
      .from(services)
      .where(eq(services.companyId, companyId))
      .orderBy(asc(services.category), asc(services.name))
  ).filter((row) => !isRetiredSlug(row.slug));
  const showAll = includeInactive && actor !== undefined && isAdmin(actor);
  return showAll ? rows : rows.filter((row) => row.active);
}

export async function companyServices(db: Db, companyId: string): Promise<schema.Service[]> {
  return db.select().from(services).where(eq(services.companyId, companyId));
}

export async function getService(db: Db, companyId: string, id: string) {
  return requireService(db, companyId, id);
}

export async function countServiceAppointments(db: Db, id: string): Promise<number> {
  const [{ used }] = await db.select({ used: count() }).from(appointments).where(eq(appointments.serviceId, id));
  return used;
}

export async function createService(db: Db, actor: Actor, raw: CreateServiceInput) {
  assertAdmin(actor);
  const input = createServiceSchema.parse(raw);

  const slug = input.slug ?? slugify(input.name);
  if (!SLUG_PATTERN.test(slug)) {
    throw new DomainError("invalid_slug", "No se pudo generar un identificador válido; indica uno manualmente");
  }

  const [taken] = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.slug, slug), eq(services.companyId, actor.companyId)))
    .limit(1);
  if (taken) throw new DomainError("slug_taken", `Ya existe un servicio con el identificador "${slug}"`);

  const [created] = await db
    .insert(services)
    .values({
      companyId: actor.companyId,
      slug,
      name: input.name,
      category: input.category,
      icon: input.icon ?? null,
      description: input.description ?? null,
      basePriceCents: input.basePriceCents,
      durationMin: input.durationMin,
      twoAddresses: input.twoAddresses,
      internalNotes: input.internalNotes ?? null,
      detailedSpecs: input.detailedSpecs ?? null,
      fields: input.fields,
      sizePrices: input.sizePrices,
      checklist: input.checklist,
    })
    .returning();
  return created;
}

export async function updateService(db: Db, actor: Actor, id: string, raw: unknown) {
  assertAdmin(actor);
  const input = updateServiceSchema.parse(raw);

  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(services).where(inCompany(actor.companyId, id)).limit(1);
    if (!current || isRetiredSlug(current.slug)) throw new DomainError("not_found", "El servicio no existe");

    if (input.twoAddresses !== undefined && input.twoAddresses !== current.twoAddresses) {
      const [{ used }] = await tx.select({ used: count() }).from(appointments).where(eq(appointments.serviceId, id));
      if (used > 0) {
        throw new DomainError(
          "service_in_use",
          "No se puede cambiar el uso de dos direcciones porque el servicio ya tiene citas",
        );
      }
    }

    const patch = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    const [updated] = await tx.update(services).set(patch).where(eq(services.id, id)).returning();
    return updated;
  });
}

export type DeleteServiceResult = { name: string; mode: "deleted" | "retired" };

export async function deleteService(db: Db, actor: Actor, id: string): Promise<DeleteServiceResult> {
  assertAdmin(actor);
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(services).where(inCompany(actor.companyId, id)).limit(1);
    if (!current || isRetiredSlug(current.slug)) throw new DomainError("not_found", "El servicio no existe");

    const [{ main }] = await tx.select({ main: count() }).from(appointments).where(eq(appointments.serviceId, id));
    const [{ items }] = await tx
      .select({ items: count() })
      .from(appointmentItems)
      .where(eq(appointmentItems.serviceId, id));

    if (main + items === 0) {
      await tx.delete(services).where(eq(services.id, id));
      return { name: current.name, mode: "deleted" };
    }

    await tx
      .update(services)
      .set({ active: false, slug: retiredSlug(current.slug, current.id) })
      .where(eq(services.id, id));
    return { name: current.name, mode: "retired" };
  });
}
