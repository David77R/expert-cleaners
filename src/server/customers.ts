import { and, asc, count, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { assertAdmin } from "@/domain/permissions";
import { escapeLike, phoneDigits } from "@/domain/customer-rules";
import {
  addressSnapshotSchema,
  createCustomerSchema,
  customerNoteSchema,
  customerSearchSchema,
  updateAddressSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type CustomerSort,
} from "@/domain/schemas";
import type { Db } from "@/server/appointments";
import { geocodeIfNeeded } from "@/server/geocoding";
import type { PhotoStorage } from "@/server/storage";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Actor = schema.Actor;

const { customers, addresses, customerNotes, appointments, appointmentHistory, appointmentPhotos } = schema;

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
  const digits = phoneDigits(input.phone);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`customer:${digits}`}))`);
    const [existing] = await tx
      .select()
      .from(customers)
      .where(
        and(
          sql`${phoneDigitsSql} = ${digits}`,
          sql`lower(trim(${customers.firstName})) = lower(${input.firstName.trim()})`,
          sql`lower(trim(${customers.lastName})) = lower(${input.lastName.trim()})`,
        ),
      )
      .limit(1);
    if (existing) {
      const existingAddresses = await tx.select().from(addresses).where(eq(addresses.customerId, existing.id));
      return { customer: existing, addresses: existingAddresses, duplicates: [], existing: true };
    }

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

    return {
      customer,
      addresses: created,
      duplicates: await findDuplicates(tx, input.phone, customer.id),
      existing: false,
    };
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

const ACCENTED = "áàäâãéèëêíìïîóòöôõúùüûñç";
const PLAIN = "aaaaaeeeeiiiiooooouuuunc";

function folded(value: SQL | AnyPgColumn): SQL {
  return sql`translate(lower(${value}), ${ACCENTED}, ${PLAIN})`;
}

function foldText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const codeNumber = sql`cast(substring(${customers.code} from 5) as integer)`;

const SORT_ORDER: Record<CustomerSort, SQL[]> = {
  recent: [desc(customers.createdAt), desc(codeNumber)],
  oldest: [asc(customers.createdAt), asc(codeNumber)],
  code_asc: [asc(codeNumber)],
  code_desc: [desc(codeNumber)],
  first_asc: [asc(folded(customers.firstName)), asc(folded(customers.lastName))],
  first_desc: [desc(folded(customers.firstName)), desc(folded(customers.lastName))],
  last_asc: [asc(folded(customers.lastName)), asc(folded(customers.firstName))],
  last_desc: [desc(folded(customers.lastName)), desc(folded(customers.firstName))],
};

export async function searchCustomers(db: Db, raw: unknown) {
  const {
    q,
    limit,
    offset,
    sort,
    city,
    marketing,
    appointments: withAppointments,
    createdFrom,
    createdTo,
  } = customerSearchSchema.parse(raw);

  const conditions: SQL[] = [];
  if (q) {
    const like = `%${escapeLike(foldText(q))}%`;
    const digits = phoneDigits(q);
    const clauses: SQL[] = [
      sql`${folded(sql`concat(${customers.firstName}, ' ', ${customers.lastName})`)} like ${like}`,
      sql`${folded(sql`concat(${customers.lastName}, ' ', ${customers.firstName})`)} like ${like}`,
      sql`lower(${customers.code}) like ${like}`,
      sql`${folded(sql`coalesce(${customers.email}, '')`)} like ${like}`,
    ];
    if (digits.length >= 3) clauses.push(sql`${phoneDigitsSql} like ${`%${digits}%`}`);
    const match = or(...clauses);
    if (match) conditions.push(match);
  }
  if (city) {
    conditions.push(
      sql`exists (select 1 from ${addresses} where ${addresses.customerId} = ${customers.id} and ${folded(
        sql`${addresses.city}`,
      )} like ${`%${escapeLike(foldText(city))}%`})`,
    );
  }
  if (marketing !== "any") conditions.push(eq(customers.allowMarketing, marketing === "yes"));
  if (withAppointments !== "any") {
    const exists = sql`exists (select 1 from ${appointments} where ${appointments.customerId} = ${customers.id})`;
    conditions.push(withAppointments === "with" ? exists : sql`not ${exists}`);
  }
  if (createdFrom)
    conditions.push(sql`(${customers.createdAt} at time zone 'America/New_York')::date >= ${createdFrom}`);
  if (createdTo) conditions.push(sql`(${customers.createdAt} at time zone 'America/New_York')::date <= ${createdTo}`);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      customer: customers,
      appointmentCount: sql<number>`(select count(*) from ${appointments} where ${appointments.customerId} = ${customers.id})`,
    })
    .from(customers)
    .where(where)
    .orderBy(...SORT_ORDER[sort])
    .limit(limit + 1)
    .offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(customers).where(where);

  const page = rows.slice(0, limit);
  const ids = page.map((row) => row.customer.id);
  const pageAddresses =
    ids.length > 0 ? await db.select().from(addresses).where(inArray(addresses.customerId, ids)) : [];

  return {
    items: page.map((row) => ({
      ...row.customer,
      appointmentCount: Number(row.appointmentCount),
      addresses: pageAddresses.filter((address) => address.customerId === row.customer.id),
    })),
    hasMore: rows.length > limit,
    total: Number(total),
  };
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

  const recentAppointments = await db.query.appointments.findMany({
    where: eq(appointments.customerId, id),
    with: {
      address: true,
      service: true,
      agent: true,
      technician: true,
      deliveryTechnician: true,
      items: { orderBy: [asc(schema.appointmentItems.position)], with: { service: true } },
    },
    orderBy: [desc(appointments.date), desc(appointments.startMin)],
    limit: 50,
  });

  const [{ total }] = await db.select({ total: count() }).from(appointments).where(eq(appointments.customerId, id));

  return { ...row, appointments: recentAppointments, appointmentCount: Number(total) };
}

export async function deleteCustomer(
  db: Db,
  actor: Actor,
  id: string,
  options: { confirmCode?: string; storage?: Pick<PhotoStorage, "remove"> } = {},
) {
  assertAdmin(actor);
  const removed = await db.transaction(async (tx) => {
    const [customer] = await tx.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (!customer) throw new DomainError("not_found", "El cliente no existe");
    const owned = await tx.select({ id: appointments.id }).from(appointments).where(eq(appointments.customerId, id));
    if (owned.length > 0 && options.confirmCode?.trim().toUpperCase() !== customer.code.toUpperCase()) {
      throw new DomainError(
        "confirmation_required",
        `Este cliente tiene ${owned.length} ${owned.length === 1 ? "cita" : "citas"}. Escribe su código (${customer.code}) para confirmar que también se borran.`,
      );
    }
    const ids = owned.map((row) => row.id);
    const photoPaths =
      ids.length > 0
        ? (
            await tx
              .select({ path: appointmentPhotos.storagePath })
              .from(appointmentPhotos)
              .where(inArray(appointmentPhotos.appointmentId, ids))
          ).map((row) => row.path)
        : [];
    if (ids.length > 0) await tx.delete(appointments).where(inArray(appointments.id, ids));
    await tx.delete(customers).where(eq(customers.id, id));
    return { id, appointments: ids.length, photoPaths };
  });
  if (options.storage) {
    for (const path of removed.photoPaths) {
      await options.storage.remove(path).catch((error) => console.error(error));
    }
  }
  return { id: removed.id, appointments: removed.appointments };
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
  const coordsGiven = input.lat != null && input.lng != null;
  const saving = LOCATION_FIELDS.some((field) => input[field] !== undefined);
  if (coordsGiven) {
    const checked = await geocodeIfNeeded({
      line1: input.line1 ?? current.line1,
      unit: input.unit ?? current.unit,
      city: input.city ?? current.city,
      state: input.state ?? current.state,
      zip: input.zip ?? current.zip,
      lat: input.lat,
      lng: input.lng,
    });
    patch.lat = checked.lat;
    patch.lng = checked.lng;
    if (checked.zip !== (input.zip ?? current.zip)) patch.zip = checked.zip;
  } else if (saving) {
    const located = await geocodeIfNeeded({
      line1: input.line1 ?? current.line1,
      unit: input.unit ?? current.unit,
      city: input.city ?? current.city,
      state: input.state ?? current.state,
      zip: input.zip ?? current.zip,
      lat: null,
      lng: null,
    });
    if (located.lat != null || moved) {
      patch.lat = located.lat ?? null;
      patch.lng = located.lng ?? null;
    }
    if (located.zip !== (input.zip ?? current.zip)) patch.zip = located.zip;
  }

  const [address] = await db.update(addresses).set(patch).where(eq(addresses.id, addressId)).returning();
  return address;
}

export async function relocateAddress(db: Db, customerId: string, addressId: string) {
  const current = await requireAddress(db, customerId, addressId);
  const located = await geocodeIfNeeded({
    line1: current.line1,
    unit: current.unit,
    city: current.city,
    state: current.state,
    zip: current.zip,
    lat: null,
    lng: null,
  });
  if (located.lat == null || located.lng == null) return { address: current, found: false };
  const [address] = await db
    .update(addresses)
    .set({ lat: located.lat, lng: located.lng, zip: located.zip })
    .where(eq(addresses.id, addressId))
    .returning();
  return { address, found: true };
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

export async function possibleDuplicates(db: Db, customer: schema.Customer): Promise<DuplicateMatch[]> {
  return db
    .select({ id: customers.id, code: customers.code, firstName: customers.firstName, lastName: customers.lastName })
    .from(customers)
    .where(
      and(
        ne(customers.id, customer.id),
        or(
          sql`${phoneDigitsSql} = ${phoneDigits(customer.phone)}`,
          and(
            sql`lower(trim(${customers.firstName})) = lower(${customer.firstName.trim()})`,
            sql`lower(trim(${customers.lastName})) = lower(${customer.lastName.trim()})`,
          ),
        ),
      ),
    )
    .orderBy(asc(customers.code))
    .limit(10);
}

export async function findCustomerByCode(db: Db, code: string): Promise<schema.Customer | null> {
  const clean = code.trim().toUpperCase();
  const normalized = /^\d+$/.test(clean) ? `CLI-${clean}` : clean;
  const [row] = await db.select().from(customers).where(eq(customers.code, normalized)).limit(1);
  return row ?? null;
}

function addressKey(address: Pick<schema.Address, "line1" | "unit" | "zip">): string {
  const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${clean(address.line1)}|${clean(address.unit)}|${clean(address.zip)}`;
}

export async function mergeCustomers(db: Db, actor: Actor, sourceId: string, targetId: string) {
  assertAdmin(actor);
  if (sourceId === targetId) throw new DomainError("same_customer", "Elige un cliente distinto para unir");
  return db.transaction(async (tx) => {
    const source = await requireCustomer(tx, sourceId);
    const target = await requireCustomer(tx, targetId);

    const targetAddresses = await tx.select().from(addresses).where(eq(addresses.customerId, target.id));
    const byKey = new Map(targetAddresses.map((address) => [addressKey(address), address.id]));
    const sourceAddresses = await tx.select().from(addresses).where(eq(addresses.customerId, source.id));
    for (const address of sourceAddresses) {
      const existing = byKey.get(addressKey(address));
      if (existing) {
        await tx.update(appointments).set({ addressId: existing }).where(eq(appointments.addressId, address.id));
        await tx.delete(addresses).where(eq(addresses.id, address.id));
      } else {
        await tx.update(addresses).set({ customerId: target.id }).where(eq(addresses.id, address.id));
        byKey.set(addressKey(address), address.id);
      }
    }

    const moved = await tx
      .update(appointments)
      .set({ customerId: target.id, updatedAt: new Date() })
      .where(eq(appointments.customerId, source.id))
      .returning({ id: appointments.id });
    if (moved.length > 0) {
      await tx.insert(appointmentHistory).values(
        moved.map((row) => ({
          appointmentId: row.id,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          field: "customer",
          fromValue: source.code,
          toValue: target.code,
        })),
      );
    }

    await tx.update(customerNotes).set({ customerId: target.id }).where(eq(customerNotes.customerId, source.id));

    const notes = [target.notes, source.notes]
      .map((note) => note?.trim() ?? "")
      .filter((note, index, list) => note !== "" && list.indexOf(note) === index)
      .join("\n");
    await tx
      .update(customers)
      .set({
        email: target.email ?? source.email,
        notes: notes === "" ? null : notes,
        allowMarketing: target.allowMarketing || source.allowMarketing,
      })
      .where(eq(customers.id, target.id));

    await tx.insert(customerNotes).values({
      customerId: target.id,
      authorId: actor.id,
      authorName: actor.name,
      text: `Se unió el cliente ${source.code} (${source.firstName} ${source.lastName}, ${source.phone}) con ${moved.length} ${moved.length === 1 ? "cita" : "citas"}.`,
    });

    await tx.delete(customers).where(eq(customers.id, source.id));
    return { target, movedAppointments: moved.length };
  });
}
