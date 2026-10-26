import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { vehicleSchema, type VehicleInput } from "@/domain/vehicles";
import type { Db } from "@/server/appointments";

const { customers, vehicles } = schema;
const idSchema = z.uuid();

export async function listVehicles(db: Db, rawCustomerId: string): Promise<schema.Vehicle[]> {
  const customerId = idSchema.parse(rawCustomerId);
  return db.select().from(vehicles).where(eq(vehicles.customerId, customerId)).orderBy(asc(vehicles.createdAt));
}

export async function createVehicle(db: Db, rawCustomerId: string, raw: VehicleInput): Promise<schema.Vehicle> {
  const customerId = idSchema.parse(rawCustomerId);
  const input = vehicleSchema.parse(raw);
  const [customer] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) throw new DomainError("not_found", "El cliente no existe");
  const [created] = await db
    .insert(vehicles)
    .values({ customerId, ...input })
    .returning();
  return created;
}

export async function updateVehicle(
  db: Db,
  rawCustomerId: string,
  rawVehicleId: string,
  raw: VehicleInput,
): Promise<schema.Vehicle> {
  const customerId = idSchema.parse(rawCustomerId);
  const vehicleId = idSchema.parse(rawVehicleId);
  const input = vehicleSchema.parse(raw);
  const [updated] = await db
    .update(vehicles)
    .set(input)
    .where(and(eq(vehicles.id, vehicleId), eq(vehicles.customerId, customerId)))
    .returning();
  if (!updated) throw new DomainError("not_found", "El vehículo no existe");
  return updated;
}

export async function deleteVehicle(db: Db, rawCustomerId: string, rawVehicleId: string): Promise<void> {
  const customerId = idSchema.parse(rawCustomerId);
  const vehicleId = idSchema.parse(rawVehicleId);
  const removed = await db
    .delete(vehicles)
    .where(and(eq(vehicles.id, vehicleId), eq(vehicles.customerId, customerId)))
    .returning({ id: vehicles.id });
  if (removed.length === 0) throw new DomainError("not_found", "El vehículo no existe");
}

export async function assertVehiclesBelong(
  db: Pick<Db, "select">,
  customerId: string,
  vehicleIds: readonly (string | null | undefined)[],
): Promise<void> {
  const ids = [...new Set(vehicleIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;
  const rows = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(and(inArray(vehicles.id, ids), eq(vehicles.customerId, customerId)));
  if (rows.length !== ids.length) {
    throw new DomainError("vehicle_mismatch", "El vehículo no pertenece a este cliente");
  }
}
