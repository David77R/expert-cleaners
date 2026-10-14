import { and, asc, count, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { assertAdmin } from "@/domain/permissions";
import { createAgentSchema, updateAgentSchema, type CreateAgentInput, type UpdateAgentInput } from "@/domain/schemas";
import type { Db } from "@/server/appointments";
import type { UserAdmin } from "@/server/user-admin";

type Actor = schema.Actor;

const { profiles, appointments, appointmentHistory, customerNotes, appointmentPhotos, routeDrafts } = schema;

export type AgentView = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: Date;
};

async function requireAgentProfile(db: Db, id: string): Promise<schema.Profile> {
  const [row] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, id), eq(profiles.role, "agent")))
    .limit(1);
  if (!row) throw new DomainError("not_found", "El agente no existe");
  return row;
}

export async function listAgents(db: Db, auth: UserAdmin): Promise<AgentView[]> {
  const [rows, accounts] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.role, "agent")).orderBy(asc(profiles.name)),
    auth.listUsers(),
  ]);
  const byId = new Map(accounts.map((account) => [account.id, account]));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: byId.get(row.id)?.email ?? "",
    active: row.active,
    createdAt: row.createdAt,
  }));
}

export async function getAgent(db: Db, auth: UserAdmin, id: string): Promise<AgentView> {
  const profile = await requireAgentProfile(db, id);
  const account = (await auth.listUsers()).find((item) => item.id === id);
  return {
    id: profile.id,
    name: profile.name,
    email: account?.email ?? "",
    active: profile.active,
    createdAt: profile.createdAt,
  };
}

export async function agentActivity(db: Db, id: string): Promise<number> {
  const counts = await Promise.all([
    db.select({ n: count() }).from(appointments).where(eq(appointments.agentId, id)),
    db.select({ n: count() }).from(appointmentHistory).where(eq(appointmentHistory.actorId, id)),
    db.select({ n: count() }).from(customerNotes).where(eq(customerNotes.authorId, id)),
    db.select({ n: count() }).from(appointmentPhotos).where(eq(appointmentPhotos.uploadedBy, id)),
    db.select({ n: count() }).from(routeDrafts).where(eq(routeDrafts.createdById, id)),
  ]);
  return counts.reduce((sum, [row]) => sum + row.n, 0);
}

export async function createAgent(db: Db, auth: UserAdmin, actor: Actor, raw: CreateAgentInput) {
  assertAdmin(actor);
  const input = createAgentSchema.parse(raw);
  const account = await auth.createUser(input);
  try {
    const [profile] = await db
      .insert(profiles)
      .values({ id: account.id, name: input.name, role: "agent", active: true })
      .onConflictDoUpdate({ target: profiles.id, set: { name: input.name, role: "agent", active: true } })
      .returning();
    return profile;
  } catch (error) {
    await auth.deleteUser(account.id).catch(() => undefined);
    throw error;
  }
}

export async function updateAgent(db: Db, auth: UserAdmin, actor: Actor, id: string, raw: UpdateAgentInput) {
  assertAdmin(actor);
  const input = updateAgentSchema.parse(raw);
  const current = await requireAgentProfile(db, id);
  const account = (await auth.listUsers()).find((item) => item.id === id);

  const changes = {
    name: input.name !== current.name ? input.name : undefined,
    email: account && input.email !== account.email ? input.email : undefined,
    password: input.password,
  };
  if (Object.values(changes).some((value) => value !== undefined)) await auth.updateUser(id, changes);
  if (input.active !== current.active) await auth.setBanned(id, !input.active);

  const [updated] = await db
    .update(profiles)
    .set({ name: input.name, active: input.active })
    .where(eq(profiles.id, id))
    .returning();
  return updated;
}

export async function deleteAgent(db: Db, auth: UserAdmin, actor: Actor, id: string) {
  assertAdmin(actor);
  await requireAgentProfile(db, id);
  if ((await agentActivity(db, id)) > 0) {
    throw new DomainError(
      "agent_has_activity",
      "Este agente ya trabajó en el sistema (citas, notas o historial), así que no se puede eliminar. Desactívalo para quitarle el acceso.",
    );
  }
  await auth.deleteUser(id);
  await db.delete(profiles).where(eq(profiles.id, id));
}
