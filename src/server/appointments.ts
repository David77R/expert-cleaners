import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
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
  rescheduleSchema,
  addressSnapshotSchema,
  type CreateAppointmentInput,
} from "@/domain/schemas";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Actor = schema.Actor;
type AppointmentRow = schema.Appointment;

export type Mutation = { appointment: AppointmentRow; conflicts: TimeBlock[] };

const { appointments, appointmentHistory, addresses, services, technicians } = schema;

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

async function nextCode(tx: Tx): Promise<string> {
  const [row] = await tx
    .select({ max: sql<number>`coalesce(max(cast(substring(${appointments.code} from 5) as integer)), 2000)` })
    .from(appointments);
  return `SVC-${Number(row.max) + 1}`;
}

export async function createAppointment(db: Db, actor: Actor, raw: CreateAppointmentInput): Promise<Mutation> {
  const input = createAppointmentSchema.parse(raw);
  return db.transaction(async (tx) => {
    const [service] = await tx.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
    if (!service || !service.active) throw new DomainError("service_unavailable", "El servicio no está disponible");

    const [address] = await tx.select().from(addresses).where(eq(addresses.id, input.addressId)).limit(1);
    if (!address || address.customerId !== input.customerId) {
      throw new DomainError("address_mismatch", "La dirección no pertenece al cliente");
    }

    if (service.twoAddresses && !input.destinationAddress) {
      throw new DomainError("destination_required", "Este servicio requiere dirección de entrega");
    }
    if (!service.twoAddresses && input.destinationAddress) {
      throw new DomainError("destination_not_allowed", "Este servicio no usa dirección de entrega");
    }

    const [tech] = await tx.select().from(technicians).where(eq(technicians.id, input.technicianId)).limit(1);
    if (!tech || !tech.active) throw new DomainError("technician_unavailable", "El técnico no está activo");

    const missing = service.fields.filter(
      (f) => f.required && (input.specs[f.key] === undefined || input.specs[f.key] === ""),
    );
    if (missing.length > 0) {
      throw new DomainError("specs_required", `Faltan especificaciones: ${missing.map((m) => m.label).join(", ")}`);
    }

    const code = await nextCode(tx);
    const [created] = await tx
      .insert(appointments)
      .values({
        code,
        agentId: actor.id,
        customerId: input.customerId,
        addressId: input.addressId,
        serviceId: input.serviceId,
        technicianId: input.technicianId,
        date: input.date,
        startMin: input.startMin,
        durationMin: input.durationMin,
        priceCents: service.basePriceCents,
        notes: input.notes,
        specs: input.specs,
        alerts: input.alerts,
        destinationAddress: input.destinationAddress ?? null,
        billingAddress: input.billingAddress ?? null,
      })
      .returning();

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
    changes.push(
      { field: "status", from: current.status, to: "rescheduled" },
      { field: "reschedule_reason", from: null, to: reason },
    );
    const updated = await persist(
      tx,
      actor,
      current,
      { status: "rescheduled", date: input.date, startMin: input.startMin, technicianId, rescheduleReason: reason },
      changes,
    );
    return { appointment: updated, conflicts: await conflictsFor(tx, toBlock(updated)) };
  });
}

export async function moveAppointment(db: Db, actor: Actor, id: string, raw: unknown): Promise<Mutation> {
  const input = moveSchema.parse(raw);
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    if (current.status === "cancelled" || current.status === "completed") {
      throw new DomainError("not_movable", "Esta cita ya no se puede mover");
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
  const address = addressSnapshotSchema.parse(raw);
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    const [service] = await tx.select().from(services).where(eq(services.id, current.serviceId)).limit(1);
    if (!service?.twoAddresses)
      throw new DomainError("destination_not_allowed", "Este servicio no usa dirección de entrega");
    const updated = await persist(tx, actor, current, { destinationAddress: address }, [
      { field: "destination_address", from: JSON.stringify(current.destinationAddress), to: JSON.stringify(address) },
    ]);
    return { appointment: updated, conflicts: [] };
  });
}

export async function setBillingAddress(db: Db, actor: Actor, id: string, raw: unknown): Promise<Mutation> {
  const address = addressSnapshotSchema.parse(raw);
  return db.transaction(async (tx) => {
    const current = await load(tx, id);
    const updated = await persist(tx, actor, current, { billingAddress: address }, [
      { field: "billing_address", from: JSON.stringify(current.billingAddress), to: JSON.stringify(address) },
    ]);
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

export async function getDay(db: Db, date: string, technicianId?: string) {
  const where = technicianId
    ? and(eq(appointments.date, date), eq(appointments.technicianId, technicianId))
    : eq(appointments.date, date);
  const rows = await db.query.appointments.findMany({
    where,
    with: { customer: true, address: true, service: true, technician: true },
    orderBy: [asc(appointments.startMin)],
  });
  const active = rows.filter((r) => r.status !== "cancelled");
  const overlapIds = new Set<string>();
  for (const row of active) {
    if (findConflicts(toBlock(row), active.map(toBlock)).length > 0) overlapIds.add(row.id);
  }
  return { appointments: rows, overlapIds: [...overlapIds] };
}

export async function getAppointment(db: Db, id: string) {
  const row = await db.query.appointments.findFirst({
    where: eq(appointments.id, id),
    with: {
      customer: true,
      address: true,
      service: true,
      technician: true,
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
