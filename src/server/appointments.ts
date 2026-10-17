import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import {
  assertTransition,
  DomainError,
  findConflicts,
  formatMinutes,
  requireReason,
  resolveCancelReason,
  type FieldChange,
  type TimeBlock,
} from "@/domain/appointment-rules";
import {
  cancelSchema,
  createAppointmentSchema,
  moveSchema,
  rangeQuerySchema,
  rescheduleSchema,
  setAddressSchema,
  addressSnapshotSchema,
  updateItemsSchema,
  stageSchema,
  readyDateSchema,
  deliverySchema,
  type CreateAppointmentInput,
} from "@/domain/schemas";
import {
  cleanDetails,
  fieldsForService,
  itemsTotal,
  summarizeItems,
  type ItemDetails,
  type ItemInput,
} from "@/domain/appointment-items";
import { formatAddress, formatMoney } from "@/domain/invoice";
import { hasDelivery } from "@/domain/delivery";
import { geocodeIfNeeded } from "@/server/geocoding";
import { isPickupService } from "@/domain/pickup";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Actor = schema.Actor;
type AppointmentRow = schema.Appointment;

export type Mutation = { appointment: AppointmentRow; conflicts: TimeBlock[] };

const { appointments, appointmentHistory, appointmentItems, addresses, services, technicians } = schema;

type ResolvedItem = {
  serviceId: string;
  specs: Record<string, string | number>;
  details: ItemDetails;
  priceCents: number;
  service: schema.Service;
};

function toBlock(
  a: Pick<AppointmentRow, "id" | "technicianId" | "date" | "startMin" | "durationMin" | "status">,
): TimeBlock {
  return {
    id: a.id,
    technicianId: a.technicianId,
    date: a.date,
    startMin: a.startMin,
    durationMin: a.durationMin,
    status: a.status,
  };
}

async function load(tx: Tx | Db, id: string): Promise<AppointmentRow> {
  const [row] = await tx.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  if (!row) throw new DomainError("not_found", "La cita no existe");
  return row;
}

async function conflictsFor(tx: Tx | Db, candidate: TimeBlock): Promise<TimeBlock[]> {
  const sameDay = await tx
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.date, candidate.date),
        eq(appointments.technicianId, candidate.technicianId),
        ne(appointments.status, "cancelled"),
      ),
    );
  return findConflicts(candidate, sameDay.map(toBlock));
}

export type ConflictPartner = { id: string; code: string; startMin: number; durationMin: number };

export async function conflictingAppointments(db: Db, id: string): Promise<ConflictPartner[]> {
  const current = await load(db, id);
  if (current.status === "cancelled") return [];
  const sameDay = await db
    .select({
      id: appointments.id,
      code: appointments.code,
      technicianId: appointments.technicianId,
      date: appointments.date,
      startMin: appointments.startMin,
      durationMin: appointments.durationMin,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.date, current.date),
        eq(appointments.technicianId, current.technicianId),
        ne(appointments.status, "cancelled"),
      ),
    )
    .orderBy(asc(appointments.startMin));
  const clashing = new Set(findConflicts(toBlock(current), sameDay.map(toBlock)).map((block) => block.id));
  return sameDay
    .filter((row) => clashing.has(row.id))
    .map((row) => ({ id: row.id, code: row.code, startMin: row.startMin, durationMin: row.durationMin }));
}

async function persist(
  tx: Tx,
  actor: Actor,
  current: AppointmentRow,
  patch: Partial<schema.NewAppointment>,
  changes: FieldChange[],
): Promise<AppointmentRow> {
  const [updated] = await tx
    .update(appointments)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(appointments.id, current.id))
    .returning();
  if (changes.length > 0) {
    await tx.insert(appointmentHistory).values(
      changes.map((c) => ({
        appointmentId: current.id,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        field: c.field,
        fromValue: c.from,
        toValue: c.to,
      })),
    );
  }
  return updated;
}

async function resolveItems(
  tx: Tx,
  requested: readonly ItemInput[],
  allowInactive: ReadonlySet<string> = new Set(),
): Promise<ResolvedItem[]> {
  const ids = [...new Set(requested.map((item) => item.serviceId))];
  const found = ids.length > 0 ? await tx.select().from(services).where(inArray(services.id, ids)) : [];
  const byId = new Map(found.map((service) => [service.id, service]));
  return requested.map((item) => {
    const service = byId.get(item.serviceId);
    if (!service || (!service.active && !allowInactive.has(service.id))) {
      throw new DomainError("service_unavailable", "El servicio no está disponible");
    }
    const missing = fieldsForService(service).filter(
      (field) => field.required && (item.specs[field.key] === undefined || item.specs[field.key] === ""),
    );
    if (missing.length > 0) {
      throw new DomainError(
        "specs_required",
        `Faltan especificaciones de ${service.name}: ${missing.map((m) => m.label).join(", ")}`,
      );
    }
    return {
      serviceId: service.id,
      specs: item.specs,
      details: cleanDetails(item.details ?? {}),
      priceCents: item.priceCents ?? service.basePriceCents,
      service,
    };
  });
}

async function currentItems(tx: Tx, current: AppointmentRow): Promise<ResolvedItem[]> {
  const rows = await tx
    .select({ item: appointmentItems, service: services })
    .from(appointmentItems)
    .innerJoin(services, eq(services.id, appointmentItems.serviceId))
    .where(eq(appointmentItems.appointmentId, current.id))
    .orderBy(asc(appointmentItems.position));
  if (rows.length > 0) {
    return rows.map(({ item, service }) => ({
      serviceId: item.serviceId,
      specs: item.specs,
      details: item.details,
      priceCents: item.priceCents,
      service,
    }));
  }
  const [service] = await tx.select().from(services).where(eq(services.id, current.serviceId)).limit(1);
  return service
    ? [{ serviceId: service.id, specs: current.specs, details: {}, priceCents: current.priceCents, service }]
    : [];
}

async function saveItems(tx: Tx, appointmentId: string, items: readonly ResolvedItem[]) {
  const existing = await tx
    .select({ id: appointmentItems.id })
    .from(appointmentItems)
    .where(eq(appointmentItems.appointmentId, appointmentId))
    .orderBy(asc(appointmentItems.position), asc(appointmentItems.createdAt));
  for (const [position, item] of items.entries()) {
    const values = {
      serviceId: item.serviceId,
      specs: item.specs,
      details: item.details,
      priceCents: item.priceCents,
      position,
    };
    const current = existing[position];
    if (current) await tx.update(appointmentItems).set(values).where(eq(appointmentItems.id, current.id));
    else await tx.insert(appointmentItems).values({ appointmentId, ...values });
  }
  const leftover = existing.slice(items.length).map((row) => row.id);
  if (leftover.length > 0) await tx.delete(appointmentItems).where(inArray(appointmentItems.id, leftover));
}

function itemSignature(items: readonly Pick<ResolvedItem, "serviceId" | "specs" | "details" | "priceCents">[]): string {
  const sorted = (value: object) => Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(
    items.map((item) => [item.serviceId, item.priceCents, sorted(item.specs), sorted(item.details ?? {})]),
  );
}

function itemSummary(items: readonly ResolvedItem[]): string {
  return summarizeItems(items.map((item) => ({ serviceName: item.service.name, priceCents: item.priceCents })));
}

async function nextCode(tx: Tx): Promise<string> {
  const [row] = await tx
    .select({ max: sql<number>`coalesce(max(cast(substring(${appointments.code} from 5) as integer)), 2000)` })
    .from(appointments);
  return `SVC-${Number(row.max) + 1}`;
}

export async function createAppointment(db: Db, actor: Actor, raw: CreateAppointmentInput): Promise<Mutation> {
  const input = createAppointmentSchema.parse(raw);
  const destinationAddress = input.destinationAddress ? await geocodeIfNeeded(input.destinationAddress) : null;
  const billingAddress = input.billingAddress ? await geocodeIfNeeded(input.billingAddress) : null;
  const requested = input.items ?? (input.serviceId ? [{ serviceId: input.serviceId, specs: input.specs }] : []);
  if (requested.length === 0) throw new DomainError("service_required", "Elige un servicio");
  return db.transaction(async (tx) => {
    const items = await resolveItems(tx, requested);
    const twoAddresses = items.some((item) => item.service.twoAddresses);

    const [address] = await tx.select().from(addresses).where(eq(addresses.id, input.addressId)).limit(1);
    if (!address || address.customerId !== input.customerId) {
      throw new DomainError("address_mismatch", "La dirección no pertenece al cliente");
    }

    if (twoAddresses && !input.destinationAddress) {
      throw new DomainError("destination_required", "Este servicio requiere dirección de entrega");
    }
    if (!twoAddresses && !items.some((item) => isPickupService(item.service)) && input.destinationAddress) {
      throw new DomainError("destination_not_allowed", "Este servicio no usa dirección de entrega");
    }

    const [tech] = await tx.select().from(technicians).where(eq(technicians.id, input.technicianId)).limit(1);
    if (!tech || !tech.active) throw new DomainError("technician_unavailable", "El técnico no está activo");

    if (input.delivery) {
      if (input.delivery.date < input.date) {
        throw new DomainError("delivery_before_service", "La entrega no puede ser antes de la recogida");
      }
      if (input.delivery.technicianId !== tech.id) {
        const [deliveryTech] = await tx
          .select()
          .from(technicians)
          .where(eq(technicians.id, input.delivery.technicianId))
          .limit(1);
        if (!deliveryTech || !deliveryTech.active) {
          throw new DomainError("technician_unavailable", "El técnico de la entrega no está activo");
        }
      }
    }

    const code = await nextCode(tx);
    const [created] = await tx
      .insert(appointments)
      .values({
        code,
        agentId: actor.id,
        customerId: input.customerId,
        addressId: input.addressId,
        serviceId: items[0].serviceId,
        technicianId: input.technicianId,
        date: input.date,
        startMin: input.startMin,
        durationMin: input.durationMin,
        priceCents: itemsTotal(items),
        notes: input.notes,
        specs: items[0].specs,
        alerts: input.alerts,
        destinationAddress,
        billingAddress,
        readyDate: input.readyDate ?? null,
        ...(input.delivery
          ? {
              deliveryDate: input.delivery.date,
              deliveryStartMin: input.delivery.startMin,
              deliveryDurationMin: input.delivery.durationMin,
              deliveryTechnicianId: input.delivery.technicianId,
            }
          : {}),
      })
      .returning();

    await saveItems(tx, created.id, items);

    await tx.insert(appointmentHistory).values({
      appointmentId: created.id,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      field: "created",
      fromValue: null,
      toValue: "not_confirmed",
    });

    return { appointment: created, conflicts: await conflictsFor(tx, toBlock(created)) };
  });
}

export async function confirmAppointment(db: Db, actor: Actor, id: string): Promise<Mutation> {
  return transition(db, actor, id, "confirmed");
}

export async function unconfirmAppointment(db: Db, actor: Actor, id: string): Promise<Mutation> {
  return transition(db, actor, id, "not_confirmed");
}

export async function completeAppointment(db: Db, actor: Actor, id: string): Promise<Mutation> {
  return transition(db, actor, id, "completed");
}

async function transition(db: Db, actor: Actor, id: string, to: schema.AppointmentStatus): Promise<Mutation> {
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    assertTransition(current.status, to);
    const updated = await persist(tx, actor, current, { status: to }, [{ field: "status", from: current.status, to }]);
    return { appointment: updated, conflicts: [] };
  });
}

export async function cancelAppointment(db: Db, actor: Actor, id: string, raw: unknown): Promise<Mutation> {
  const input = cancelSchema.parse(raw);
  const reason = resolveCancelReason(input.reason, input.explanation);
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    assertTransition(current.status, "cancelled");
    const updated = await persist(tx, actor, current, { status: "cancelled", cancellationReason: reason }, [
      { field: "status", from: current.status, to: "cancelled" },
      { field: "cancellation_reason", from: null, to: reason },
    ]);
    return { appointment: updated, conflicts: [] };
  });
}

export async function rescheduleAppointment(db: Db, actor: Actor, id: string, raw: unknown): Promise<Mutation> {
  const input = rescheduleSchema.parse(raw);
  const reason = requireReason(input.reason, "reason_required", "El motivo de reprogramación es obligatorio");
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    assertTransition(current.status, "rescheduled");
    const technicianId = input.technicianId ?? current.technicianId;
    const changes: FieldChange[] = [
      {
        field: "schedule",
        from: `${current.date} ${formatMinutes(current.startMin)}`,
        to: `${input.date} ${formatMinutes(input.startMin)}`,
      },
    ];
    if (technicianId !== current.technicianId)
      changes.push({ field: "technician", from: current.technicianId, to: technicianId });
    const durationMin = input.durationMin ?? current.durationMin;
    if (durationMin !== current.durationMin)
      changes.push({ field: "duration", from: String(current.durationMin), to: String(durationMin) });
    changes.push(
      { field: "status", from: current.status, to: "rescheduled" },
      { field: "reschedule_reason", from: null, to: reason },
    );
    const updated = await persist(
      tx,
      actor,
      current,
      {
        status: "rescheduled",
        date: input.date,
        startMin: input.startMin,
        durationMin,
        technicianId,
        rescheduleReason: reason,
      },
      changes,
    );
    return { appointment: updated, conflicts: await conflictsFor(tx, toBlock(updated)) };
  });
}

export async function moveAppointment(db: Db, actor: Actor, id: string, raw: unknown): Promise<Mutation> {
  const input = moveSchema.parse(raw);
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    if (current.status === "cancelled") {
      throw new DomainError("not_movable", "Una cita cancelada no se puede mover");
    }
    const changes: FieldChange[] = [];
    if (input.startMin !== current.startMin) {
      changes.push({ field: "start_time", from: formatMinutes(current.startMin), to: formatMinutes(input.startMin) });
    }
    if (input.technicianId !== current.technicianId) {
      changes.push({ field: "technician", from: current.technicianId, to: input.technicianId });
    }
    const updated = await persist(
      tx,
      actor,
      current,
      { startMin: input.startMin, technicianId: input.technicianId },
      changes,
    );
    return { appointment: updated, conflicts: await conflictsFor(tx, toBlock(updated)) };
  });
}

export async function markPaid(db: Db, actor: Actor, id: string): Promise<Mutation> {
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    if (current.status === "cancelled") throw new DomainError("cancelled", "Una cita cancelada no se puede cobrar");
    if (current.paymentStatus === "paid") return { appointment: current, conflicts: [] };
    const updated = await persist(tx, actor, current, { paymentStatus: "paid" }, [
      { field: "payment", from: "unpaid", to: "paid" },
    ]);
    return { appointment: updated, conflicts: [] };
  });
}

export async function advanceInvoice(db: Db, actor: Actor, id: string): Promise<Mutation> {
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    if (current.invoiceStatus === "sent") throw new DomainError("invoice_sent", "La factura ya fue enviada");
    const next = current.invoiceStatus === "not_generated" ? "generated" : "sent";
    const updated = await persist(tx, actor, current, { invoiceStatus: next }, [
      { field: "invoice", from: current.invoiceStatus, to: next },
    ]);
    return { appointment: updated, conflicts: [] };
  });
}

export async function setDestinationAddress(db: Db, actor: Actor, id: string, raw: unknown): Promise<Mutation> {
  const parsed = raw === null ? null : addressSnapshotSchema.parse(raw);
  const address = parsed ? await geocodeIfNeeded(parsed) : null;
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    const items = await currentItems(tx, current);
    const twoAddresses = items.some((item) => item.service.twoAddresses);
    if (!twoAddresses && !items.some((item) => isPickupService(item.service))) {
      throw new DomainError("destination_not_allowed", "Este servicio no usa dirección de entrega");
    }
    if (!address && twoAddresses) {
      throw new DomainError("destination_required", "Este servicio requiere dirección de entrega");
    }
    const updated = await persist(tx, actor, current, { destinationAddress: address }, [
      { field: "destination_address", from: JSON.stringify(current.destinationAddress), to: JSON.stringify(address) },
    ]);
    return { appointment: updated, conflicts: [] };
  });
}

export async function setBillingAddress(db: Db, actor: Actor, id: string, raw: unknown): Promise<Mutation> {
  const parsed = addressSnapshotSchema.parse(raw);
  const address = await geocodeIfNeeded(parsed);
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    const updated = await persist(tx, actor, current, { billingAddress: address }, [
      { field: "billing_address", from: JSON.stringify(current.billingAddress), to: JSON.stringify(address) },
    ]);
    return { appointment: updated, conflicts: [] };
  });
}

export async function setAppointmentAddress(db: Db, actor: Actor, id: string, raw: unknown): Promise<Mutation> {
  const { addressId } = setAddressSchema.parse(raw);
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    if (current.status === "cancelled") {
      throw new DomainError("cancelled", "Una cita cancelada no se puede modificar");
    }
    if (current.addressId === addressId) return { appointment: current, conflicts: [] };
    const found = await tx
      .select()
      .from(addresses)
      .where(inArray(addresses.id, [current.addressId, addressId]));
    const next = found.find((row) => row.id === addressId);
    if (!next || next.customerId !== current.customerId) {
      throw new DomainError("address_mismatch", "La dirección no pertenece al cliente");
    }
    const previous = found.find((row) => row.id === current.addressId);
    const updated = await persist(tx, actor, current, { addressId }, [
      { field: "address", from: previous ? formatAddress(previous) : null, to: formatAddress(next) },
    ]);
    return { appointment: updated, conflicts: [] };
  });
}

export async function updateAppointmentItems(db: Db, actor: Actor, id: string, raw: unknown): Promise<Mutation> {
  const input = updateItemsSchema.parse(raw);
  const destination = input.destinationAddress ? await geocodeIfNeeded(input.destinationAddress) : null;
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    if (current.status === "cancelled") {
      throw new DomainError("cancelled", "Una cita cancelada no se puede modificar");
    }
    if (current.invoiceStatus === "sent") {
      throw new DomainError(
        "invoice_sent",
        "La factura ya fue enviada; no se pueden cambiar los servicios ni el precio",
      );
    }
    const previous = await currentItems(tx, current);
    const items = await resolveItems(tx, input.items, new Set(previous.map((item) => item.serviceId)));

    let destinationAddress = current.destinationAddress;
    if (items.some((item) => item.service.twoAddresses)) {
      destinationAddress = destination ?? destinationAddress;
      if (!destinationAddress) {
        throw new DomainError("destination_required", "Agrega la dirección de entrega para este servicio");
      }
    } else if (items.some((item) => isPickupService(item.service))) {
      destinationAddress = destination ?? destinationAddress;
    } else {
      destinationAddress = null;
    }

    const total = itemsTotal(items);
    const durationMin = input.durationMin ?? current.durationMin;
    const changes: FieldChange[] = [];
    const itemsChanged = itemSignature(previous) !== itemSignature(items);
    if (itemsChanged) changes.push({ field: "items", from: itemSummary(previous), to: itemSummary(items) });
    if (total !== current.priceCents) {
      changes.push({ field: "price", from: formatMoney(current.priceCents), to: formatMoney(total) });
    }
    if (durationMin !== current.durationMin) {
      changes.push({ field: "duration", from: String(current.durationMin), to: String(durationMin) });
    }
    if (JSON.stringify(destinationAddress) !== JSON.stringify(current.destinationAddress)) {
      changes.push({
        field: "destination_address",
        from: JSON.stringify(current.destinationAddress),
        to: JSON.stringify(destinationAddress),
      });
    }
    if (changes.length === 0) return { appointment: current, conflicts: [] };

    if (itemsChanged) await saveItems(tx, current.id, items);
    const updated = await persist(
      tx,
      actor,
      current,
      { serviceId: items[0].serviceId, specs: items[0].specs, priceCents: total, durationMin, destinationAddress },
      changes,
    );
    const conflicts = durationMin !== current.durationMin ? await conflictsFor(tx, toBlock(updated)) : [];
    return { appointment: updated, conflicts };
  });
}

function assertEditable(current: AppointmentRow) {
  if (current.status === "cancelled") {
    throw new DomainError("cancelled", "Una cita cancelada no se puede modificar");
  }
}

export async function setStage(db: Db, actor: Actor, id: string, raw: unknown): Promise<Mutation> {
  const { stage, done } = stageSchema.parse(raw);
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    assertEditable(current);
    if (Boolean(current.stages[stage]) === done) return { appointment: current, conflicts: [] };
    const stages = { ...current.stages };
    if (done) stages[stage] = { at: new Date().toISOString(), by: actor.name };
    else delete stages[stage];
    const updated = await persist(tx, actor, current, { stages }, [
      { field: "stage", from: stage, to: done ? "done" : "undone" },
    ]);
    return { appointment: updated, conflicts: [] };
  });
}

export async function setReadyDate(db: Db, actor: Actor, id: string, raw: unknown): Promise<Mutation> {
  const { readyDate } = readyDateSchema.parse(raw);
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    assertEditable(current);
    if (current.readyDate === readyDate) return { appointment: current, conflicts: [] };
    const updated = await persist(tx, actor, current, { readyDate }, [
      { field: "ready_date", from: current.readyDate, to: readyDate },
    ]);
    return { appointment: updated, conflicts: [] };
  });
}

function deliveryLabel(date: string, startMin: number): string {
  return `${date} ${formatMinutes(startMin)}`;
}

export async function scheduleDelivery(db: Db, actor: Actor, id: string, raw: unknown): Promise<Mutation> {
  const input = deliverySchema.parse(raw);
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    assertEditable(current);
    if (input.date < current.date) {
      throw new DomainError("delivery_before_service", "La entrega no puede ser antes de la fecha de la cita");
    }
    const [tech] = await tx.select().from(technicians).where(eq(technicians.id, input.technicianId)).limit(1);
    if (!tech || !tech.active) throw new DomainError("technician_unavailable", "El técnico no está activo");

    const previous = hasDelivery(current) ? deliveryLabel(current.deliveryDate, current.deliveryStartMin) : null;
    const updated = await persist(
      tx,
      actor,
      current,
      {
        deliveryDate: input.date,
        deliveryStartMin: input.startMin,
        deliveryDurationMin: input.durationMin,
        deliveryTechnicianId: input.technicianId,
      },
      [{ field: "delivery", from: previous, to: deliveryLabel(input.date, input.startMin) }],
    );
    const conflicts = await conflictsFor(tx, {
      id: current.id,
      technicianId: input.technicianId,
      date: input.date,
      startMin: input.startMin,
      durationMin: input.durationMin,
      status: current.status,
    });
    return { appointment: updated, conflicts };
  });
}

export async function clearDelivery(db: Db, actor: Actor, id: string): Promise<Mutation> {
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    if (!hasDelivery(current)) return { appointment: current, conflicts: [] };
    const updated = await persist(
      tx,
      actor,
      current,
      { deliveryDate: null, deliveryStartMin: null, deliveryDurationMin: null, deliveryTechnicianId: null },
      [{ field: "delivery", from: deliveryLabel(current.deliveryDate, current.deliveryStartMin), to: null }],
    );
    return { appointment: updated, conflicts: [] };
  });
}

export async function updateNotes(db: Db, actor: Actor, id: string, notes: string): Promise<Mutation> {
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    if (current.notes === notes) return { appointment: current, conflicts: [] };
    const updated = await persist(tx, actor, current, { notes }, [
      { field: "notes", from: current.notes || null, to: notes || null },
    ]);
    return { appointment: updated, conflicts: [] };
  });
}

function overlapIdsOf(rows: AppointmentRow[]): string[] {
  const active = rows.filter((r) => r.status !== "cancelled");
  const groups = new Map<string, AppointmentRow[]>();
  for (const row of active) {
    const key = `${row.date}|${row.technicianId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const ids = new Set<string>();
  for (const group of groups.values()) {
    const blocks = group.map(toBlock);
    for (const row of group) {
      if (findConflicts(toBlock(row), blocks).length > 0) ids.add(row.id);
    }
  }
  return [...ids];
}

export async function getDay(db: Db, date: string, technicianId?: string) {
  const where = technicianId
    ? and(eq(appointments.date, date), eq(appointments.technicianId, technicianId))
    : eq(appointments.date, date);
  const rows = await db.query.appointments.findMany({
    where,
    with: {
      customer: true,
      address: true,
      service: true,
      technician: true,
      deliveryTechnician: true,
      items: { orderBy: [asc(appointmentItems.position)], with: { service: true } },
    },
    orderBy: [asc(appointments.startMin)],
  });
  return { appointments: rows, overlapIds: overlapIdsOf(rows) };
}

export async function getRange(db: Db, raw: unknown) {
  const { from, to, technicianId } = rangeQuerySchema.parse(raw);
  const conditions = [gte(appointments.date, from), lte(appointments.date, to)];
  if (technicianId) conditions.push(eq(appointments.technicianId, technicianId));

  const rows = await db.query.appointments.findMany({
    where: and(...conditions),
    with: {
      customer: true,
      address: true,
      service: true,
      technician: true,
      deliveryTechnician: true,
      items: { orderBy: [asc(appointmentItems.position)], with: { service: true } },
    },
    orderBy: [asc(appointments.date), asc(appointments.startMin)],
  });

  const countsByDate: Record<string, number> = {};
  for (const row of rows) {
    if (row.status !== "cancelled") countsByDate[row.date] = (countsByDate[row.date] ?? 0) + 1;
  }
  return { appointments: rows, overlapIds: overlapIdsOf(rows), countsByDate };
}

export async function getDeliveries(db: Db, from: string, to: string, technicianId?: string) {
  const conditions = [
    gte(appointments.deliveryDate, from),
    lte(appointments.deliveryDate, to),
    ne(appointments.status, "cancelled"),
  ];
  if (technicianId) conditions.push(eq(appointments.deliveryTechnicianId, technicianId));
  return db.query.appointments.findMany({
    where: and(...conditions),
    with: {
      customer: true,
      address: true,
      service: true,
      technician: true,
      deliveryTechnician: true,
      items: { orderBy: [asc(appointmentItems.position)], with: { service: true } },
    },
    orderBy: [asc(appointments.deliveryDate), asc(appointments.deliveryStartMin)],
  });
}

export async function getAppointment(db: Db, id: string) {
  const row = await db.query.appointments.findFirst({
    where: eq(appointments.id, id),
    with: {
      customer: { with: { addresses: true } },
      address: true,
      service: true,
      technician: true,
      deliveryTechnician: true,
      items: { orderBy: [asc(appointmentItems.position)], with: { service: true } },
      agent: true,
      photos: true,
      history: { orderBy: [desc(appointmentHistory.createdAt)] },
    },
  });
  if (!row) throw new DomainError("not_found", "La cita no existe");
  return row;
}

export async function listByIds(db: Db, ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(appointments).where(inArray(appointments.id, ids));
}
