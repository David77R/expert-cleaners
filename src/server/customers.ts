import { and, asc, count, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { escapeLike, phoneDigits } from "@/domain/customer-rules";
import {
  addressSnapshotSchema,
  createCustomerSchema,
  customerNoteSchema,
  customerSearchSchema,
  updateAddressSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
} from "@/domain/schemas";
import type { Db } from "@/server/appointments";
import { geocodeIfNeeded } from "@/server/geocoding";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Actor = schema.Actor;

const { customers, addresses, customerNotes, appointments, services } = schema;

export type DuplicateMatch = { id: string; code: string; firstName: string; lastName: string };

const phoneDigitsSql = sql`regexp_replace(${customers.phone}, '[^0-9]', '', 'g')`;

async function nextCode(tx: Tx): Promise<string> {
  const [row] = await tx
    .select({ max: sql<number>`coalesce(max(cast(substring(${customers.code} from 5) as integer)), 1000)` })
    .from(customers);
  return `CLI-${Number(row.max) + 1}`;
}

async function findDuplicates(tx: Tx | Db, phone: string, excludeId: string): Promise<DuplicateMatch[]> {
  const digits = phoneDigits(phone);
  return tx
    .select({ id: customers.id, code: customers.code, firstName: customers.firstName, lastName: customers.lastName })
    .from(customers)
    .where(and(sql`${phoneDigitsSql} = ${digits}`, ne(customers.id, excludeId)));
}

async function requireCustomer(tx: Tx | Db, id: string): Promise<schema.Customer> {
  const [row] = await tx.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!row) throw new DomainError("not_found", "El cliente no existe");
  return row;
}

async function requireAddress(tx: Tx | Db, customerId: string, addressId: string): Promise<schema.Address> {
  const [row] = await tx
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, addressId), eq(addresses.customerId, customerId)))
    .limit(1);
  if (!row) throw new DomainError("not_found", "La dirección no existe");
  return row;
}

function definedOnly<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as Partial<T>;
}

export async function createCustomer(db: Db, raw: CreateCustomerInput) {
  const input = createCustomerSchema.parse(raw);
  const located = await Promise.all(input.addresses.map((address) => geocodeIfNeeded(address)));
  return db.transaction(async (tx) => {
    const code = await nextCode(tx);
    const [customer] = await tx
      .insert(customers)
      .values({
        code,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email ?? null,
        notes: input.notes ?? null,
        allowMarketing: input.allowMarketing,
      })
      .returning();

    const created = await tx
      .insert(addresses)
      .values(
        located.map((a) => ({
          customerId: customer.id,
          line1: a.line1,
          unit: a.unit,
          city: a.city,
          state: a.state,
          zip: a.zip,
          notes: a.notes ?? null,
          lat: a.lat ?? null,
          lng: a.lng ?? null,
        })),
      )
      .returning();

    return { customer, addresses: created, duplicates: await findDuplicates(tx, input.phone, customer.id) };
  });
}

export async function customersByIds(db: Db, ids: string[]): Promise<DuplicateMatch[]> {
  if (ids.length === 0) return [];
  return db
    .select({ id: customers.id, code: customers.code, firstName: customers.firstName, lastName: customers.lastName })
    .from(customers)
    .where(inArray(customers.id, ids))
    .orderBy(asc(customers.code));
}

export async function updateCustomer(db: Db, id: string, raw: unknown) {
  const input = updateCustomerSchema.parse(raw);
  return db.transaction(async (tx) => {
    const current = await requireCustomer(tx, id);
    const [customer] = await tx.update(customers).set(definedOnly(input)).where(eq(customers.id, id)).returning();
    const phoneChanged = input.phone !== undefined && phoneDigits(input.phone) !== phoneDigits(current.phone);
    return { customer, duplicates: phoneChanged ? await findDuplicates(tx, customer.phone, id) : [] };
  });
}

export async function searchCustomers(db: Db, raw: unknown) {
  const { q, limit, offset } = customerSearchSchema.parse(raw);

  let where: SQL | undefined;
  if (q) {
    const like = `%${escapeLike(q)}%`;
    const digits = phoneDigits(q);
    const clauses: SQL[] = [
      sql`concat(${customers.firstName}, ' ', ${customers.lastName}) ilike ${like}`,
      sql`${customers.code} ilike ${like}`,
      sql`coalesce(${customers.email}, '') ilike ${like}`,
    ];
    if (digits.length >= 3) clauses.push(sql`${phoneDigitsSql} like ${`%${digits}%`}`);
    where = or(...clauses);
  }

  const rows = await db.query.customers.findMany({
    where,
    with: { addresses: true },
    orderBy: [asc(customers.lastName), asc(customers.firstName)],
    limit: limit + 1,
    offset,
  });

  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function getCustomerSummary(db: Db, id: string) {
  const row = await db.query.customers.findFirst({
    where: eq(customers.id, id),
    columns: { id: true, code: true, firstName: true, lastName: true, phone: true },
    with: {
      addresses: { columns: { id: true, line1: true, unit: true, city: true, state: true, zip: true } },
    },
  });
  return row ?? null;
}

export async function getCustomer(db: Db, id: string) {
  const row = await db.query.customers.findFirst({
    where: eq(customers.id, id),
    with: { addresses: true, history: { orderBy: [desc(customerNotes.createdAt)] } },
  });
  if (!row) throw new DomainError("not_found", "El cliente no existe");

  const recentAppointments = await db
    .select({
      id: appointments.id,
      code: appointments.code,
      date: appointments.date,
      startMin: appointments.startMin,
      status: appointments.status,
      priceCents: appointments.priceCents,
      serviceName: services.name,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(eq(appointments.customerId, id))
    .orderBy(desc(appointments.date), desc(appointments.startMin))
    .limit(20);

  return { ...row, appointments: recentAppointments };
}

export async function addAddress(db: Db, customerId: string, raw: unknown) {
  const input = await geocodeIfNeeded(addressSnapshotSchema.parse(raw));
  await requireCustomer(db, customerId);
  const [address] = await db
    .insert(addresses)
    .values({
      customerId,
      line1: input.line1,
      unit: input.unit,
      city: input.city,
      state: input.state,
      zip: input.zip,
      notes: input.notes ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
    })
    .returning();
  return address;
}

const LOCATION_FIELDS = ["line1", "unit", "city", "state", "zip"] as const;

export async function updateAddress(db: Db, customerId: string, addressId: string, raw: unknown) {
  const input = updateAddressSchema.parse(raw);
  const current = await requireAddress(db, customerId, addressId);
  const patch: Record<string, unknown> = definedOnly(input);

  const moved = LOCATION_FIELDS.some((field) => input[field] !== undefined && input[field] !== current[field]);
  const coordsGiven = input.lat !== undefined || input.lng !== undefined;
  if (moved && !coordsGiven) {
    const located = await geocodeIfNeeded({
      line1: input.line1 ?? current.line1,
      unit: input.unit ?? current.unit,
      city: input.city ?? current.city,
      state: input.state ?? current.state,
      zip: input.zip ?? current.zip,
      lat: null,
      lng: null,
    });
    patch.lat = located.lat ?? null;
    patch.lng = located.lng ?? null;
  }

  const [address] = await db.update(addresses).set(patch).where(eq(addresses.id, addressId)).returning();
  return address;
}

export async function locateMissingAddresses(
  db: Db,
  rows: { id: string; line1: string; unit: string | null; city: string; state: string; zip: string }[],
  limit = 10,
): Promise<Map<string, { lat: number; lng: number }>> {
  const found = new Map<string, { lat: number; lng: number }>();
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()].slice(0, limit);
  for (const row of unique) {
    const located = await geocodeIfNeeded({ ...row, unit: row.unit ?? undefined, lat: null, lng: null });
    if (located.lat == null || located.lng == null) continue;
    await db.update(addresses).set({ lat: located.lat, lng: located.lng }).where(eq(addresses.id, row.id));
    found.set(row.id, { lat: located.lat, lng: located.lng });
  }
  return found;
}

export async function deleteAddress(db: Db, customerId: string, addressId: string) {
  return db.transaction(async (tx) => {
    await requireAddress(tx, customerId, addressId);

    const [{ total }] = await tx.select({ total: count() }).from(addresses).where(eq(addresses.customerId, customerId));
    if (total <= 1) {
      throw new DomainError("last_address", "El cliente debe conservar al menos una dirección");
    }

    const [{ used }] = await tx
      .select({ used: count() })
      .from(appointments)
      .where(eq(appointments.addressId, addressId));
    if (used > 0) {
      throw new DomainError("address_in_use", "La dirección tiene citas asociadas y no se puede eliminar");
    }

    await tx.delete(addresses).where(eq(addresses.id, addressId));
    return { id: addressId };
  });
}

export async function addCustomerNote(db: Db, actor: Actor, customerId: string, raw: unknown) {
  const input = customerNoteSchema.parse(raw);
  await requireCustomer(db, customerId);
  const [note] = await db
    .insert(customerNotes)
    .values({ customerId, authorId: actor.id, authorName: actor.name, text: input.text })
    .returning();
  return note;
}
