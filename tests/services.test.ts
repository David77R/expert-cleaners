import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { AGENT_JOSUE } from "@/db/seed-data";
import { assertAdmin } from "@/domain/permissions";
import { slugify } from "@/domain/service-rules";
import { createAppointment } from "@/server/appointments";
import { createService, getService, listServices, updateService } from "@/server/services";
import { appointmentInput, createTestDb } from "./helpers";

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;

const ADMIN = { id: AGENT_JOSUE.id, name: "Admin", role: "admin" as const };

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.client.close();
});

function newService(overrides: Record<string, unknown> = {}) {
  return {
    name: "Limpieza de Colchones",
    category: "Colchones",
    basePriceCents: 12000,
    durationMin: 45,
    ...overrides,
  };
}

describe("reglas del catálogo", () => {
  it("genera slugs sin acentos ni símbolos", () => {
    expect(slugify("Limpieza de Sofás")).toBe("limpieza-de-sofas");
    expect(slugify("  Tapetes & Alfombras (XL)  ")).toBe("tapetes-alfombras-xl");
    expect(slugify("¡¡¡")).toBe("");
  });

  it("solo un administrador pasa assertAdmin", () => {
    expect(() => assertAdmin(ADMIN)).not.toThrow();
    expect(() => assertAdmin(AGENT_JOSUE)).toThrowError(expect.objectContaining({ code: "forbidden" }));
  });
});

describe("crear servicio", () => {
  it("genera el slug desde el nombre y aplica valores por defecto", async () => {
    const created = await createService(ctx.db, ADMIN, newService());
    expect(created.slug).toBe("limpieza-de-colchones");
    expect(created.active).toBe(true);
    expect(created.twoAddresses).toBe(false);
    expect(created.fields).toEqual([]);
  });

  it("guarda el ícono elegido, lo cambia y rechaza íconos inexistentes", async () => {
    const created = await createService(ctx.db, ADMIN, newService({ name: "Tapete persa", icon: "rug" }));
    expect(created.icon).toBe("rug");
    const changed = await updateService(ctx.db, ADMIN, created.id, { icon: null });
    expect(changed.icon).toBeNull();
    await expect(createService(ctx.db, ADMIN, newService({ name: "Otro", icon: "unicornio" }))).rejects.toThrow();
  });

  it("acepta un slug manual y rechaza duplicados", async () => {
    await createService(ctx.db, ADMIN, newService({ name: "Cortinas", slug: "cortinas" }));
    await expect(
      createService(ctx.db, ADMIN, newService({ name: "Otras cortinas", slug: "cortinas" })),
    ).rejects.toMatchObject({
      code: "slug_taken",
    });
    await expect(createService(ctx.db, ADMIN, newService({ name: "Cortinas" }))).rejects.toMatchObject({
      code: "slug_taken",
    });
  });

  it("pide un slug manual cuando el nombre no genera uno válido", async () => {
    await expect(createService(ctx.db, ADMIN, newService({ name: "¡¡¡" }))).rejects.toMatchObject({
      code: "invalid_slug",
    });
  });

  it("un agente no puede crear servicios", async () => {
    await expect(createService(ctx.db, AGENT_JOSUE, newService({ name: "Prohibido" }))).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("valida precio, duración y campos de especificación", async () => {
    const bad = (overrides: Record<string, unknown>) =>
      expect(createService(ctx.db, ADMIN, newService({ name: "Inválido", ...overrides }))).rejects.toBeInstanceOf(
        ZodError,
      );
    await bad({ basePriceCents: -1 });
    await bad({ basePriceCents: 10.5 });
    await bad({ durationMin: 5 });
    await bad({ slug: "Con Espacios" });
    await bad({ fields: [{ key: "Mal Key", label: "x", type: "number", required: true }] });
    await bad({ fields: [{ key: "tipo", label: "Tipo", type: "select", required: true }] });
    await bad({ fields: [{ key: "n", label: "N", type: "number", required: true, options: ["a"] }] });
    await bad({
      fields: [
        { key: "a", label: "A", type: "number", required: true },
        { key: "a", label: "B", type: "number", required: false },
      ],
    });
    await bad({ fields: [{ key: "t", label: "T", type: "select", required: true, options: ["x", "x"] }] });
  });

  it("guarda campos de selección con sus opciones", async () => {
    const created = await createService(
      ctx.db,
      ADMIN,
      newService({
        name: "Tapicería de Sillas",
        fields: [{ key: "material", label: "Material", type: "select", required: true, options: ["Tela", "Cuero"] }],
      }),
    );
    expect(created.fields[0].options).toEqual(["Tela", "Cuero"]);
  });
});

describe("listar y consultar", () => {
  it("los agentes solo ven servicios activos", async () => {
    const created = await createService(ctx.db, ADMIN, newService({ name: "Servicio Oculto" }));
    await updateService(ctx.db, ADMIN, created.id, { active: false });

    const forAgent = await listServices(ctx.db, { includeInactive: "true" }, AGENT_JOSUE);
    expect(forAgent.map((s) => s.id)).not.toContain(created.id);

    const forAdmin = await listServices(ctx.db, { includeInactive: "true" }, ADMIN);
    expect(forAdmin.map((s) => s.id)).toContain(created.id);

    const defaultAdmin = await listServices(ctx.db, {}, ADMIN);
    expect(defaultAdmin.map((s) => s.id)).not.toContain(created.id);
  });

  it("ordena por categoría y nombre", async () => {
    const list = await listServices(ctx.db, {}, ADMIN);
    const keys = list.map((s) => `${s.category}|${s.name}`);
    expect(keys).toEqual([...keys].sort());
  });

  it("falla con not_found si el servicio no existe", async () => {
    await expect(getService(ctx.db, "00000000-0000-4000-8000-0000000000ff")).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("actualizar servicio", () => {
  it("cambia solo los campos enviados y no permite cambiar el slug", async () => {
    const created = await createService(ctx.db, ADMIN, newService({ name: "Pisos", slug: "pisos" }));
    const updated = await updateService(ctx.db, ADMIN, created.id, { basePriceCents: 20000 });
    expect(updated.basePriceCents).toBe(20000);
    expect(updated.name).toBe("Pisos");
    await expect(updateService(ctx.db, ADMIN, created.id, { slug: "otro" })).rejects.toBeInstanceOf(ZodError);
    await expect(updateService(ctx.db, ADMIN, created.id, {})).rejects.toBeInstanceOf(ZodError);
  });

  it("un agente no puede actualizar servicios", async () => {
    await expect(updateService(ctx.db, AGENT_JOSUE, ctx.services.sofa.id, { basePriceCents: 1 })).rejects.toMatchObject(
      {
        code: "forbidden",
      },
    );
  });

  it("cambiar el precio no altera las citas existentes", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-12-01" }));
    const before = appointment.priceCents;
    await updateService(ctx.db, ADMIN, ctx.services.sofa.id, { basePriceCents: before + 5000 });

    const { appointment: next } = await createAppointment(
      ctx.db,
      AGENT_JOSUE,
      appointmentInput(ctx, { date: "2026-12-02" }),
    );
    expect(next.priceCents).toBe(before + 5000);
    expect(appointment.priceCents).toBe(before);
    await updateService(ctx.db, ADMIN, ctx.services.sofa.id, { basePriceCents: before });
  });

  it("un servicio desactivado ya no admite citas nuevas", async () => {
    const created = await createService(ctx.db, ADMIN, newService({ name: "Temporal", slug: "temporal" }));
    await updateService(ctx.db, ADMIN, created.id, { active: false });
    await expect(
      createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { serviceId: created.id, specs: {} })),
    ).rejects.toMatchObject({ code: "service_unavailable" });
  });

  it("los campos requeridos nuevos se exigen en las citas siguientes", async () => {
    const created = await createService(ctx.db, ADMIN, newService({ name: "Cojines", slug: "cojines" }));
    const base = appointmentInput(ctx, { serviceId: created.id, specs: {}, date: "2026-12-03" });
    await createAppointment(ctx.db, AGENT_JOSUE, base);

    await updateService(ctx.db, ADMIN, created.id, {
      fields: [{ key: "units", label: "Unidades", type: "number", required: true }],
    });
    await expect(createAppointment(ctx.db, AGENT_JOSUE, base)).rejects.toMatchObject({ code: "specs_required" });
    await expect(createAppointment(ctx.db, AGENT_JOSUE, { ...base, specs: { units: 4 } })).resolves.toBeDefined();
  });

  it("bloquea el cambio de dos direcciones cuando el servicio ya tiene citas", async () => {
    await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-12-04" }));
    await expect(updateService(ctx.db, ADMIN, ctx.services.sofa.id, { twoAddresses: true })).rejects.toMatchObject({
      code: "service_in_use",
    });

    const unused = await createService(ctx.db, ADMIN, newService({ name: "Sin Citas", slug: "sin-citas" }));
    const flipped = await updateService(ctx.db, ADMIN, unused.id, { twoAddresses: true });
    expect(flipped.twoAddresses).toBe(true);
  });

  it("permite enviar twoAddresses sin cambio aunque haya citas", async () => {
    const updated = await updateService(ctx.db, ADMIN, ctx.services.sofa.id, { twoAddresses: false, durationMin: 75 });
    expect(updated.durationMin).toBe(75);
  });

  it("limpia campos opcionales con null", async () => {
    const created = await createService(
      ctx.db,
      ADMIN,
      newService({ name: "Notas", slug: "notas", description: "Algo", internalNotes: "Interno" }),
    );
    const updated = await updateService(ctx.db, ADMIN, created.id, { description: null, internalNotes: null });
    expect(updated.description).toBeNull();
    expect(updated.internalNotes).toBeNull();
  });
});
