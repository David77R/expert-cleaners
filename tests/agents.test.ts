import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EXPERT_CLEANERS_COMPANY_ID } from "@/domain/companies";
import { ZodError } from "zod";
import { profiles } from "@/db/schema";
import { AGENT_JOSUE } from "@/db/seed-data";
import { createAppointment } from "@/server/appointments";
import { agentActivity, createAgent, deleteAgent, getAgent, listAgents, updateAgent } from "@/server/agents";
import { appointmentInput, createTestDb } from "./helpers";
import { createFakeUserAdmin, type FakeUserAdmin } from "./user-admin-fake";

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;
let auth: FakeUserAdmin;

const ADMIN = { id: AGENT_JOSUE.id, name: "Admin", role: "admin" as const, companyId: EXPERT_CLEANERS_COMPANY_ID };
const AGENT = {
  id: AGENT_JOSUE.id,
  name: AGENT_JOSUE.name,
  role: "agent" as const,
  companyId: EXPERT_CLEANERS_COMPANY_ID,
};

function newAgent(overrides: Record<string, unknown> = {}) {
  return { name: "Laura Gómez", email: "laura@expert.test", password: "temporal123", ...overrides };
}

beforeAll(async () => {
  ctx = await createTestDb();
  auth = createFakeUserAdmin();
});

afterAll(async () => {
  await ctx.client.close();
});

describe("crear agentes", () => {
  it("el administrador crea la cuenta y el perfil de agente", async () => {
    const profile = await createAgent(ctx.db, auth, ADMIN, newAgent({ email: "  Laura@Expert.TEST " }));
    expect(profile.role).toBe("agent");
    expect(profile.active).toBe(true);
    const account = auth.accounts.get(profile.id);
    expect(account?.email).toBe("laura@expert.test");
    expect(account?.name).toBe("Laura Gómez");
  });

  it("un agente no puede crear agentes", async () => {
    await expect(createAgent(ctx.db, auth, AGENT, newAgent({ email: "otro@expert.test" }))).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("rechaza un correo repetido y una contraseña corta", async () => {
    await expect(createAgent(ctx.db, auth, ADMIN, newAgent())).rejects.toMatchObject({ code: "email_taken" });
    await expect(
      createAgent(ctx.db, auth, ADMIN, newAgent({ email: "corta@expert.test", password: "123" })),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("lista solo agentes, con su correo", async () => {
    const agents = await listAgents(ctx.db, auth, EXPERT_CLEANERS_COMPANY_ID);
    const laura = agents.find((agent) => agent.name === "Laura Gómez");
    expect(laura?.email).toBe("laura@expert.test");
    expect(agents.every((agent) => agent.name !== "Admin")).toBe(true);
  });
});

describe("editar agentes", () => {
  it("cambia nombre, correo y contraseña", async () => {
    const created = await createAgent(ctx.db, auth, ADMIN, newAgent({ name: "Pedro", email: "pedro@expert.test" }));
    await updateAgent(ctx.db, auth, ADMIN, created.id, {
      name: "Pedro Ruiz",
      email: "pedro.ruiz@expert.test",
      password: "nueva-clave-1",
      active: true,
    });
    const agent = await getAgent(ctx.db, auth, EXPERT_CLEANERS_COMPANY_ID, created.id);
    expect(agent).toMatchObject({ name: "Pedro Ruiz", email: "pedro.ruiz@expert.test", active: true });
    expect(auth.accounts.get(created.id)?.password).toBe("nueva-clave-1");
  });

  it("desactivar le quita el acceso y reactivar se lo devuelve", async () => {
    const created = await createAgent(ctx.db, auth, ADMIN, newAgent({ name: "Ana", email: "ana@expert.test" }));
    const base = { name: "Ana", email: "ana@expert.test" };
    await updateAgent(ctx.db, auth, ADMIN, created.id, { ...base, active: false });
    expect((await getAgent(ctx.db, auth, EXPERT_CLEANERS_COMPANY_ID, created.id)).active).toBe(false);
    expect(auth.accounts.get(created.id)?.banned).toBe(true);
    await updateAgent(ctx.db, auth, ADMIN, created.id, { ...base, active: true });
    expect(auth.accounts.get(created.id)?.banned).toBe(false);
  });

  it("no permite editar ni eliminar al administrador desde la sección de agentes", async () => {
    const adminId = "00000000-0000-4000-8000-0000000000aa";
    await ctx.db.insert(profiles).values({ id: adminId, name: "Dueño", role: "admin" });
    await expect(
      updateAgent(ctx.db, auth, ADMIN, adminId, { name: "X", email: "x@expert.test", active: false }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(deleteAgent(ctx.db, auth, ADMIN, adminId)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("eliminar agentes", () => {
  it("elimina a un agente que no ha trabajado", async () => {
    const created = await createAgent(ctx.db, auth, ADMIN, newAgent({ name: "Nuevo", email: "nuevo@expert.test" }));
    await deleteAgent(ctx.db, auth, ADMIN, created.id);
    expect(auth.accounts.has(created.id)).toBe(false);
    await expect(getAgent(ctx.db, auth, EXPERT_CLEANERS_COMPANY_ID, created.id)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("no elimina a un agente con citas registradas", async () => {
    const created = await createAgent(ctx.db, auth, ADMIN, newAgent({ name: "Con citas", email: "citas@expert.test" }));
    const worker = {
      id: created.id,
      name: created.name,
      role: "agent" as const,
      companyId: EXPERT_CLEANERS_COMPANY_ID,
    };
    await createAppointment(ctx.db, worker, appointmentInput(ctx));
    expect(await agentActivity(ctx.db, created.id)).toBeGreaterThan(0);
    await expect(deleteAgent(ctx.db, auth, ADMIN, created.id)).rejects.toMatchObject({ code: "agent_has_activity" });
  });
});
