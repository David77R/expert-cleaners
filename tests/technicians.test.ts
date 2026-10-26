import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EXPERT_CLEANERS_COMPANY_ID } from "@/domain/companies";
import { ZodError } from "zod";
import { AGENT_JOSUE } from "@/db/seed-data";
import { cancelAppointment, createAppointment } from "@/server/appointments";
import {
  createTechnician,
  deleteTechnician,
  getTechnician,
  listTechnicians,
  technicianUsage,
  updateTechnician,
} from "@/server/technicians";
import { appointmentInput, createTestDb } from "./helpers";

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;

const ADMIN = { id: AGENT_JOSUE.id, name: "Admin", role: "admin" as const, companyId: EXPERT_CLEANERS_COMPANY_ID };
const AGENT = {
  id: AGENT_JOSUE.id,
  name: AGENT_JOSUE.name,
  role: "agent" as const,
  companyId: EXPERT_CLEANERS_COMPANY_ID,
};
const TODAY = "2026-10-12";

function newTechnician(overrides: Record<string, unknown> = {}) {
  return {
    name: "Mariela Pérez",
    zone: "Miami Beach",
    color: "#1F9D7A",
    workDays: [1, 2, 3, 4, 5],
    shiftStartMin: 480,
    shiftEndMin: 1020,
    ...overrides,
  };
}

function editOf(technician: Awaited<ReturnType<typeof getTechnician>>, overrides: Record<string, unknown> = {}) {
  return {
    name: technician.name,
    zone: technician.zone,
    color: technician.color,
    workDays: technician.workDays,
    shiftStartMin: technician.shiftStartMin,
    shiftEndMin: technician.shiftEndMin,
    active: technician.active,
    ...overrides,
  };
}

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.client.close();
});

describe("crear técnicos", () => {
  it("un administrador crea un técnico activo con su horario", async () => {
    const created = await createTechnician(ctx.db, ADMIN, newTechnician({ workDays: [5, 1, 1, 3] }));
    expect(created.active).toBe(true);
    expect(created.workDays).toEqual([1, 3, 5]);
    expect(created.shiftStartMin).toBe(480);
  });

  it("un agente no puede crear técnicos", async () => {
    await expect(createTechnician(ctx.db, AGENT, newTechnician({ name: "Otro" }))).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("no permite dos técnicos con el mismo nombre, sin importar mayúsculas", async () => {
    await expect(createTechnician(ctx.db, ADMIN, newTechnician({ name: "MARIELA pérez" }))).rejects.toMatchObject({
      code: "name_taken",
    });
  });

  it("rechaza una salida antes de la entrada, sin días o con color inválido", async () => {
    await expect(
      createTechnician(ctx.db, ADMIN, newTechnician({ name: "A", shiftStartMin: 900, shiftEndMin: 600 })),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(createTechnician(ctx.db, ADMIN, newTechnician({ name: "B", workDays: [] }))).rejects.toBeInstanceOf(
      ZodError,
    );
    await expect(createTechnician(ctx.db, ADMIN, newTechnician({ name: "C", color: "rojo" }))).rejects.toBeInstanceOf(
      ZodError,
    );
  });

  it("lista los técnicos ordenados por nombre", async () => {
    const names = (await listTechnicians(ctx.db, EXPERT_CLEANERS_COMPANY_ID)).map((t) => t.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names).toContain("Mariela Pérez");
  });
});

describe("editar y desactivar", () => {
  it("guarda cambios de zona y horario", async () => {
    const tech = await createTechnician(ctx.db, ADMIN, newTechnician({ name: "Editable" }));
    const updated = await updateTechnician(ctx.db, ADMIN, tech.id, editOf(tech, { zone: "Doral", shiftEndMin: 1080 }));
    expect(updated.zone).toBe("Doral");
    expect(updated.shiftEndMin).toBe(1080);
  });

  it("no deja desactivar a un técnico con citas pendientes", async () => {
    const tech = ctx.techs[0];
    await createAppointment(ctx.db, AGENT, appointmentInput(ctx, { technicianId: tech.id, date: "2026-10-20" }));
    const current = await getTechnician(ctx.db, EXPERT_CLEANERS_COMPANY_ID, tech.id);
    await expect(
      updateTechnician(ctx.db, ADMIN, tech.id, editOf(current, { active: false }), TODAY),
    ).rejects.toMatchObject({ code: "technician_has_upcoming" });
  });

  it("sí deja desactivar cuando las citas pendientes se cancelaron", async () => {
    const tech = ctx.techs[1];
    const { appointment } = await createAppointment(
      ctx.db,
      AGENT,
      appointmentInput(ctx, { technicianId: tech.id, date: "2026-10-21" }),
    );
    await cancelAppointment(ctx.db, AGENT, appointment.id, { reason: "weather" });
    const current = await getTechnician(ctx.db, EXPERT_CLEANERS_COMPANY_ID, tech.id);
    const updated = await updateTechnician(ctx.db, ADMIN, tech.id, editOf(current, { active: false }), TODAY);
    expect(updated.active).toBe(false);
  });

  it("las citas de días anteriores no impiden desactivar", async () => {
    const tech = await createTechnician(ctx.db, ADMIN, newTechnician({ name: "Con historial" }));
    await createAppointment(ctx.db, AGENT, appointmentInput(ctx, { technicianId: tech.id, date: "2026-10-01" }));
    const usage = await technicianUsage(ctx.db, tech.id, TODAY);
    expect(usage).toEqual({ total: 1, upcoming: 0 });
    const updated = await updateTechnician(ctx.db, ADMIN, tech.id, editOf(tech, { active: false }), TODAY);
    expect(updated.active).toBe(false);
  });
});

describe("eliminar", () => {
  it("elimina un técnico que nunca tuvo citas", async () => {
    const tech = await createTechnician(ctx.db, ADMIN, newTechnician({ name: "De prueba" }));
    await deleteTechnician(ctx.db, ADMIN, tech.id);
    await expect(getTechnician(ctx.db, EXPERT_CLEANERS_COMPANY_ID, tech.id)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("no elimina a un técnico con citas registradas", async () => {
    await expect(deleteTechnician(ctx.db, ADMIN, ctx.techs[0].id)).rejects.toMatchObject({
      code: "technician_in_use",
    });
  });

  it("un agente no puede eliminar técnicos", async () => {
    const tech = await createTechnician(ctx.db, ADMIN, newTechnician({ name: "Intocable" }));
    await expect(deleteTechnician(ctx.db, AGENT, tech.id)).rejects.toMatchObject({ code: "forbidden" });
  });
});
