import { and, asc, count, eq, gte, notInArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { todayIn } from "@/domain/date-rules";
import { assertAdmin } from "@/domain/permissions";
import {
  createTechnicianSchema,
  updateTechnicianSchema,
  type CreateTechnicianInput,
  type UpdateTechnicianInput,
} from "@/domain/schemas";
import type { Db } from "@/server/appointments";

type Actor = schema.Actor;

const { technicians, appointments } = schema;

async function requireTechnician(db: Db, id: string): Promise<schema.Technician> {
  const [row] = await db.select().from(technicians).where(eq(technicians.id, id)).limit(1);
  if (!row) throw new DomainError("not_found", "El técnico no existe");
  return row;
}

async function assertNameAvailable(db: Db, name: string, excludeId?: string) {
  const rows = await db
    .select({ id: technicians.id })
    .from(technicians)
    .where(sql`lower(${technicians.name}) = lower(${name})`);
  if (rows.some((row) => row.id !== excludeId)) {
    throw new DomainError("name_taken", "Ya existe un técnico con ese nombre");
  }
}

export async function listTechnicians(db: Db): Promise<schema.Technician[]> {
  return db.select().from(technicians).orderBy(asc(technicians.name));
}

export async function getTechnician(db: Db, id: string) {
  return requireTechnician(db, id);
}

export async function technicianUsage(db: Db, id: string, today: string = todayIn()) {
  const [[{ total }], [{ upcoming }]] = await Promise.all([
    db.select({ total: count() }).from(appointments).where(eq(appointments.technicianId, id)),
    db
      .select({ upcoming: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.technicianId, id),
          gte(appointments.date, today),
          notInArray(appointments.status, ["cancelled", "completed"]),
        ),
      ),
  ]);
  return { total, upcoming };
}

export async function createTechnician(db: Db, actor: Actor, raw: CreateTechnicianInput) {
  assertAdmin(actor);
  const input = createTechnicianSchema.parse(raw);
  await assertNameAvailable(db, input.name);
  const [created] = await db.insert(technicians).values(input).returning();
  return created;
}

export async function updateTechnician(
  db: Db,
  actor: Actor,
  id: string,
  raw: UpdateTechnicianInput,
  today: string = todayIn(),
) {
  assertAdmin(actor);
  const input = updateTechnicianSchema.parse(raw);
  const current = await requireTechnician(db, id);
  await assertNameAvailable(db, input.name, id);

  if (current.active && !input.active) {
    const { upcoming } = await technicianUsage(db, id, today);
    if (upcoming > 0) {
      throw new DomainError(
        "technician_has_upcoming",
        upcoming === 1
          ? "Este técnico tiene 1 cita pendiente. Reasígnala o cancélala antes de desactivarlo."
          : `Este técnico tiene ${upcoming} citas pendientes. Reasígnalas o cancélalas antes de desactivarlo.`,
      );
    }
  }

  const [updated] = await db.update(technicians).set(input).where(eq(technicians.id, id)).returning();
  return updated;
}

export async function deleteTechnician(db: Db, actor: Actor, id: string) {
  assertAdmin(actor);
  await requireTechnician(db, id);
  const { total } = await technicianUsage(db, id);
  if (total > 0) {
    throw new DomainError(
      "technician_in_use",
      "Este técnico ya tiene citas registradas, así que no se puede eliminar. Desactívalo para que no aparezca al agendar.",
    );
  }
  await db.delete(technicians).where(eq(technicians.id, id));
}
