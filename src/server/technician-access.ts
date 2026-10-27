import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { assertAdmin } from "@/domain/permissions";
import type { Db } from "@/server/appointments";
import type { UserAdmin } from "@/server/user-admin";

type Actor = schema.Actor;

const { appointments, profiles, technicians } = schema;

export type TechnicianAccess = { profileId: string; email: string; active: boolean } | null;

const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido"));
const passwordSchema = z.string().min(8, "La contraseña debe tener al menos 8 caracteres");

export const createAccessSchema = z.object({ email: emailSchema, password: passwordSchema });

export const updateAccessSchema = z.object({
  email: emailSchema,
  password: z.union([z.literal(""), passwordSchema]).optional(),
  active: z.boolean(),
});

function assignedTo(technicianId: string) {
  return or(eq(appointments.technicianId, technicianId), eq(appointments.deliveryTechnicianId, technicianId));
}

export async function assertTechnicianAppointment(db: Db, actor: Actor, appointmentId: string): Promise<void> {
  if (actor.role !== "technician") return;
  const [row] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.companyId, actor.companyId),
        assignedTo(actor.technicianId ?? ""),
      ),
    )
    .limit(1);
  if (!row) throw new DomainError("not_found", "La cita no existe o no está asignada a ti");
}

export async function assertTechnicianCustomer(db: Db, actor: Actor, customerId: string): Promise<void> {
  if (actor.role !== "technician") return;
  const [row] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.customerId, customerId),
        eq(appointments.companyId, actor.companyId),
        assignedTo(actor.technicianId ?? ""),
      ),
    )
    .limit(1);
  if (!row) throw new DomainError("not_found", "Este cliente no tiene citas contigo");
}

async function requireTechnician(db: Db, companyId: string, technicianId: string) {
  const [row] = await db
    .select()
    .from(technicians)
    .where(and(eq(technicians.id, technicianId), eq(technicians.companyId, companyId)))
    .limit(1);
  if (!row) throw new DomainError("not_found", "El técnico no existe");
  return row;
}

async function accessProfile(db: Db, technicianId: string) {
  const [row] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.technicianId, technicianId), eq(profiles.role, "technician")))
    .limit(1);
  return row ?? null;
}

export async function getTechnicianAccess(
  db: Db,
  auth: UserAdmin,
  companyId: string,
  technicianId: string,
): Promise<TechnicianAccess> {
  await requireTechnician(db, companyId, technicianId);
  const profile = await accessProfile(db, technicianId);
  if (!profile) return null;
  const account = (await auth.listUsers()).find((item) => item.id === profile.id);
  return { profileId: profile.id, email: account?.email ?? "", active: profile.active };
}

export async function createTechnicianAccess(
  db: Db,
  auth: UserAdmin,
  actor: Actor,
  technicianId: string,
  raw: unknown,
) {
  assertAdmin(actor);
  const input = createAccessSchema.parse(raw);
  const technician = await requireTechnician(db, actor.companyId, technicianId);
  if (await accessProfile(db, technicianId)) {
    throw new DomainError("access_exists", "Este técnico ya tiene usuario");
  }
  const account = await auth.createUser({ email: input.email, password: input.password, name: technician.name });
  try {
    const [profile] = await db
      .insert(profiles)
      .values({
        id: account.id,
        companyId: actor.companyId,
        name: technician.name,
        role: "technician",
        active: true,
        technicianId,
      })
      .returning();
    return profile;
  } catch (error) {
    await auth.deleteUser(account.id).catch(() => undefined);
    throw error;
  }
}

export async function updateTechnicianAccess(
  db: Db,
  auth: UserAdmin,
  actor: Actor,
  technicianId: string,
  raw: unknown,
) {
  assertAdmin(actor);
  const input = updateAccessSchema.parse(raw);
  const technician = await requireTechnician(db, actor.companyId, technicianId);
  const profile = await accessProfile(db, technicianId);
  if (!profile) throw new DomainError("not_found", "Este técnico todavía no tiene usuario");
  const account = (await auth.listUsers()).find((item) => item.id === profile.id);

  const changes = {
    email: account && input.email !== account.email ? input.email : undefined,
    password: input.password || undefined,
    name: profile.name !== technician.name ? technician.name : undefined,
  };
  if (Object.values(changes).some((value) => value !== undefined)) await auth.updateUser(profile.id, changes);
  if (input.active !== profile.active) await auth.setBanned(profile.id, !input.active);

  const [updated] = await db
    .update(profiles)
    .set({ active: input.active, name: technician.name })
    .where(eq(profiles.id, profile.id))
    .returning();
  return updated;
}
