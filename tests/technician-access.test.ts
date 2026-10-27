import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { EXPERT_CLEANERS_COMPANY_ID } from "@/domain/companies";
import { AGENT_JOSUE } from "@/db/seed-data";
import type { Actor } from "@/db/schema";
import { canSeePhones, contactHref, hideCustomerPhones, hidePhone, maskPhone } from "@/domain/phone-privacy";
import { createAppointment } from "@/server/appointments";
import { getAgentReport } from "@/server/reports";
import {
  assertTechnicianAppointment,
  assertTechnicianCustomer,
  createTechnicianAccess,
  getTechnicianAccess,
  updateTechnicianAccess,
} from "@/server/technician-access";
import { appointmentInput, createTestDb } from "./helpers";
import { createFakeUserAdmin, type FakeUserAdmin } from "./user-admin-fake";

vi.mock("@/server/geocoding", () => ({
  geocodeIfNeeded: async (address: unknown) => address,
  getGeocoder: () => null,
}));

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;
let auth: FakeUserAdmin;
let mine: string;
let theirs: string;
let technician: Actor;

const ADMIN: Actor = { id: AGENT_JOSUE.id, name: "Admin", role: "admin", companyId: EXPERT_CLEANERS_COMPANY_ID };
const AGENT: Actor = {
  id: AGENT_JOSUE.id,
  name: AGENT_JOSUE.name,
  role: "agent",
  companyId: EXPERT_CLEANERS_COMPANY_ID,
};

beforeAll(async () => {
  ctx = await createTestDb();
  auth = createFakeUserAdmin();
  const first = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { technicianId: ctx.techs[0].id }));
  const second = await createAppointment(
    ctx.db,
    AGENT_JOSUE,
    appointmentInput(ctx, { technicianId: ctx.techs[1].id, startMin: 720 }),
  );
  mine = first.appointment.id;
  theirs = second.appointment.id;
});

afterAll(async () => {
  await ctx.client.close();
});

describe("teléfonos ocultos", () => {
  it("solo los técnicos ven el número oculto", () => {
    expect(canSeePhones({ role: "agent" })).toBe(true);
    expect(canSeePhones({ role: "admin" })).toBe(true);
    expect(canSeePhones({ role: "owner" })).toBe(true);
    expect(canSeePhones({ role: "technician" })).toBe(false);
  });

  it("deja solo los últimos cuatro dígitos", () => {
    expect(maskPhone("(804) 555-0101")).toBe("(•••) •••-0101");
    expect(maskPhone("+1 904 994 4279")).toBe("(•••) •••-4279");
    expect(maskPhone("12")).toBe("•••");
  });

  it("oculta el teléfono del cliente dentro de las citas sin tocar lo demás", () => {
    const rows = [{ id: "a", customer: { firstName: "Ana", phone: "8045550101" } }];
    const hidden = hideCustomerPhones({ role: "technician" }, rows);
    expect(hidden[0].customer).toEqual({ firstName: "Ana", phone: "(•••) •••-0101" });
    expect(rows[0].customer.phone).toBe("8045550101");
    expect(hideCustomerPhones({ role: "agent" }, rows)[0].customer.phone).toBe("8045550101");
    expect(hidePhone({ role: "technician" }, { phone: "8045550101" }).phone).toBe("(•••) •••-0101");
  });

  it("arma los enlaces de llamada y WhatsApp con el número completo", () => {
    expect(contactHref("(804) 555-0101", "call")).toBe("tel:+18045550101");
    expect(contactHref("(804) 555-0101", "whatsapp", "Hola")).toBe("https://wa.me/18045550101?text=Hola");
  });
});

describe("usuario del técnico", () => {
  it("solo un administrador lo crea", async () => {
    await expect(
      createTechnicianAccess(ctx.db, auth, AGENT, ctx.techs[0].id, { email: "tec@rva.test", password: "segura123" }),
    ).rejects.toThrow();
  });

  it("valida correo y contraseña", async () => {
    await expect(
      createTechnicianAccess(ctx.db, auth, ADMIN, ctx.techs[0].id, { email: "no-es-correo", password: "123" }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("crea la cuenta vinculada al técnico y no permite una segunda", async () => {
    const profile = await createTechnicianAccess(ctx.db, auth, ADMIN, ctx.techs[0].id, {
      email: " Tec@RVA.test ",
      password: "segura123",
    });
    expect(profile.role).toBe("technician");
    expect(profile.technicianId).toBe(ctx.techs[0].id);
    expect(profile.name).toBe(ctx.techs[0].name);
    technician = {
      id: profile.id,
      name: profile.name,
      role: "technician",
      companyId: EXPERT_CLEANERS_COMPANY_ID,
      technicianId: ctx.techs[0].id,
    };
    expect(await getTechnicianAccess(ctx.db, auth, EXPERT_CLEANERS_COMPANY_ID, ctx.techs[0].id)).toEqual({
      profileId: profile.id,
      email: "tec@rva.test",
      active: true,
    });
    await expect(
      createTechnicianAccess(ctx.db, auth, ADMIN, ctx.techs[0].id, { email: "otro@rva.test", password: "segura123" }),
    ).rejects.toThrow("ya tiene usuario");
  });

  it("solo deja abrir las citas y clientes asignados al técnico", async () => {
    await expect(assertTechnicianAppointment(ctx.db, technician, mine)).resolves.toBeUndefined();
    await expect(assertTechnicianAppointment(ctx.db, technician, theirs)).rejects.toThrow("no está asignada");
    await expect(assertTechnicianAppointment(ctx.db, AGENT, theirs)).resolves.toBeUndefined();
    await expect(assertTechnicianCustomer(ctx.db, technician, ctx.customer.id)).resolves.toBeUndefined();
    await expect(
      assertTechnicianCustomer(
        ctx.db,
        { ...technician, technicianId: ctx.techs[1].id },
        "00000000-0000-4000-8000-000000000999",
      ),
    ).rejects.toThrow();
  });

  it("desactiva el usuario y cambia la contraseña", async () => {
    await updateTechnicianAccess(ctx.db, auth, ADMIN, ctx.techs[0].id, {
      email: "tec@rva.test",
      password: "nueva1234",
      active: false,
    });
    const account = auth.accounts.get(technician.id);
    expect(account?.banned).toBe(true);
    expect(account?.password).toBe("nueva1234");
    const access = await getTechnicianAccess(ctx.db, auth, EXPERT_CLEANERS_COMPANY_ID, ctx.techs[0].id);
    expect(access?.active).toBe(false);
  });

  it("no aparece como agente en los reportes", async () => {
    const report = await getAgentReport(ctx.db, ADMIN, { from: "2026-10-01", to: "2026-10-31" });
    expect(report.agents.some((agent) => agent.agentId === technician.id)).toBe(false);
  });
});
