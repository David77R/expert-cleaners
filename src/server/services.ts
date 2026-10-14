import { asc, count, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { assertAdmin } from "@/domain/permissions";
import { SLUG_PATTERN, slugify } from "@/domain/service-rules";
import { createServiceSchema, serviceListSchema, updateServiceSchema, type CreateServiceInput } from "@/domain/schemas";
import type { Db } from "@/server/appointments";

type Actor = schema.Actor;

const { services, appointments } = schema;

async function requireService(db: Db, id: string): Promise<schema.Service> {
  const [row] = await db.select().from(services).where(eq(services.id, id)).limit(1);
  if (!row) throw new DomainError("not_found", "El servicio no existe");
  return row;
}

export async function listServices(db: Db, raw: unknown = {}, actor?: Actor) {
  const { includeInactive } = serviceListSchema.parse(raw);
  const rows = await db.select().from(services).orderBy(asc(services.category), asc(services.name));
  const showAll = includeInactive && actor?.role === "admin";
  return showAll ? rows : rows.filter((row) => row.active);
}

export async function getService(db: Db, id: string) {
  return requireService(db, id);
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

  const [taken] = await db.select({ id: services.id }).from(services).where(eq(services.slug, slug)).limit(1);
  if (taken) throw new DomainError("slug_taken", `Ya existe un servicio con el identificador "${slug}"`);

  const [created] = await db
    .insert(services)
    .values({
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
    })
    .returning();
  return created;
}

export async function updateService(db: Db, actor: Actor, id: string, raw: unknown) {
  assertAdmin(actor);
  const input = updateServiceSchema.parse(raw);

  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(services).where(eq(services.id, id)).limit(1);
    if (!current) throw new DomainError("not_found", "El servicio no existe");

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
