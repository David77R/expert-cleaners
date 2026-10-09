import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AGENT_JOSUE } from "@/db/seed-data";
import { createServiceSchema, updateServiceSchema } from "@/domain/schemas";
import {
  createServiceInputFromForm,
  describeFieldCount,
  dollarsText,
  emptyFieldDraft,
  emptyServiceForm,
  fieldKeyFromLabel,
  groupByCategory,
  parseDollars,
  parseDuration,
  parseOptions,
  readServiceForm,
  resolveFieldKeys,
  serviceFieldErrors,
  serviceFormFromService,
  updateServiceInputFromForm,
  validateServiceForm,
  type ServiceFormValues,
} from "@/domain/service-form";
import { createAppointment } from "@/server/appointments";
import { countServiceAppointments, createService, getService, updateService } from "@/server/services";
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

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

function filled(overrides: Partial<ServiceFormValues> = {}): ServiceFormValues {
  return {
    ...emptyServiceForm(),
    name: "Limpieza de Colchones",
    category: "Colchones",
    price: "120",
    durationMin: "45",
    ...overrides,
  };
}

describe("precio y duración", () => {
  it("convierte dólares a centavos", () => {
    expect(parseDollars("120")).toBe(12000);
    expect(parseDollars("120.5")).toBe(12050);
    expect(parseDollars("$1,250.99")).toBe(125099);
    expect(parseDollars(" 0 ")).toBe(0);
    expect(parseDollars("$ 80")).toBe(8000);
  });

  it("entiende la coma decimal sin confundirla con miles", () => {
    expect(parseDollars("120,50")).toBe(12050);
    expect(parseDollars("12,5")).toBe(1250);
    expect(parseDollars("1,250")).toBe(125000);
    expect(parseDollars("1,250,000")).toBeNull();
  });

  it("rechaza precios inválidos o fuera de rango", () => {
    for (const bad of ["", "abc", "12.345", "-5", "1e3", "100000.01", "1,2,3", "12,345.678", "12.5.1"]) {
      expect(parseDollars(bad)).toBeNull();
    }
    expect(parseDollars("100000")).toBe(10_000_000);
  });

  it("muestra los centavos como dólares", () => {
    expect(dollarsText(12000)).toBe("120");
    expect(dollarsText(12050)).toBe("120.50");
    expect(dollarsText(5)).toBe("0.05");
  });

  it("valida la duración entre 15 y 720 minutos enteros", () => {
    expect(parseDuration("45")).toBe(45);
    expect(parseDuration("15")).toBe(15);
    expect(parseDuration("720")).toBe(720);
    for (const bad of ["", "14", "721", "45.5", "una hora"]) expect(parseDuration(bad)).toBeNull();
  });
});

describe("claves de los datos de la cita", () => {
  it("deriva una clave camelCase sin tildes ni símbolos", () => {
    expect(fieldKeyFromLabel("Cantidad de asientos")).toBe("cantidadDeAsientos");
    expect(fieldKeyFromLabel("Tipo de tela")).toBe("tipoDeTela");
    expect(fieldKeyFromLabel("¿Cuántos cojines?")).toBe("cuantosCojines");
  });

  it("siempre empieza en letra minúscula", () => {
    expect(fieldKeyFromLabel("3 puertas")).toBe("campo3Puertas");
    expect(fieldKeyFromLabel("???")).toBe("campo");
    expect(fieldKeyFromLabel("")).toBe("campo");
  });

  it("cumple el formato que exige el esquema", () => {
    for (const label of ["Cantidad de asientos", "3 puertas", "???", "Ñandú", "A"]) {
      const result = createServiceSchema.safeParse({
        ...createServiceInputFromForm(filled({ fields: [{ ...emptyFieldDraft(), label }] })),
      });
      expect(result.success, label).toBe(true);
    }
  });

  it("conserva las claves existentes aunque cambie el nombre", () => {
    const keys = resolveFieldKeys([
      { ...emptyFieldDraft(), key: "seats", label: "Asientos del sofá" },
      { ...emptyFieldDraft(), label: "Tipo de tela" },
    ]);
    expect(keys).toEqual(["seats", "tipoDeTela"]);
  });

  it("evita claves repetidas con un sufijo numérico", () => {
    const keys = resolveFieldKeys([
      { ...emptyFieldDraft(), key: "tela", label: "Otra cosa" },
      { ...emptyFieldDraft(), label: "Tela" },
      { ...emptyFieldDraft(), label: "Tela!" },
      { ...emptyFieldDraft(), key: "tela", label: "Duplicada" },
    ]);
    expect(keys[0]).toBe("tela");
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[1]).toBe("tela2");
    expect(keys[2]).toBe("tela3");
  });

  it("ignora una clave guardada con formato inválido", () => {
    expect(resolveFieldKeys([{ ...emptyFieldDraft(), key: "Mala Clave", label: "Tipo de tela" }])).toEqual([
      "tipoDeTela",
    ]);
  });
});

describe("opciones", () => {
  it("separa por líneas y descarta vacías", () => {
    expect(parseOptions(" Tela \r\n\nCuero\n  \nMicrofibra ")).toEqual(["Tela", "Cuero", "Microfibra"]);
    expect(parseOptions("")).toEqual([]);
  });
});

describe("lectura del formulario", () => {
  it("empieza con 60 minutos, activo y sin datos extra", () => {
    const values = emptyServiceForm();
    expect(values.durationMin).toBe("60");
    expect(values.active).toBe(true);
    expect(values.fields).toEqual([]);
  });

  it("lee los datos de la cita por posición", () => {
    const values = readServiceForm(
      formData({
        name: "Sofás",
        fieldCount: "2",
        field_0_key: "seats",
        field_0_label: "Asientos",
        field_0_type: "number",
        field_0_required: "on",
        field_1_label: "Tela",
        field_1_type: "select",
        field_1_options: "Tela\nCuero",
        twoAddresses: "on",
      }),
    );
    expect(values.name).toBe("Sofás");
    expect(values.twoAddresses).toBe(true);
    expect(values.active).toBe(false);
    expect(values.fields).toEqual([
      { key: "seats", label: "Asientos", type: "number", required: true, options: "" },
      { key: "", label: "Tela", type: "select", required: false, options: "Tela\nCuero" },
    ]);
  });

  it("ignora un conteo de campos inválido y limita el máximo", () => {
    expect(readServiceForm(formData({ fieldCount: "abc" })).fields).toEqual([]);
    expect(readServiceForm(formData({ fieldCount: "-3" })).fields).toEqual([]);
    expect(readServiceForm(formData({ fieldCount: "9999" })).fields.length).toBeLessThanOrEqual(25);
  });

  it("trata cualquier tipo desconocido como número", () => {
    const values = readServiceForm(formData({ fieldCount: "1", field_0_type: "script" }));
    expect(values.fields[0].type).toBe("number");
  });

  it("ida y vuelta con un servicio guardado", async () => {
    const service = await createService(
      ctx.db,
      ADMIN,
      createServiceInputFromForm(
        filled({
          description: "Con vapor",
          internalNotes: "Llevar extractora",
          fields: [
            { key: "", label: "Piezas", type: "number", required: true, options: "" },
            { key: "", label: "Tela", type: "select", required: false, options: "Tela\nCuero" },
          ],
        }),
      ),
    );
    const values = serviceFormFromService(service);
    expect(values.price).toBe("120");
    expect(values.durationMin).toBe("45");
    expect(values.fields[1]).toMatchObject({ key: "tela", options: "Tela\nCuero" });
    expect(validateServiceForm(values)).toEqual({});
  });
});

describe("validación con mensajes claros", () => {
  it("no marca errores en un formulario completo", () => {
    expect(validateServiceForm(filled())).toEqual({});
  });

  it("pide los datos básicos", () => {
    const errors = validateServiceForm({ ...emptyServiceForm(), durationMin: "5" });
    expect(errors.name).toMatch(/nombre/i);
    expect(errors.category).toMatch(/categoría/i);
    expect(errors.price).toMatch(/precio/i);
    expect(errors.durationMin).toMatch(/15 y 720/);
  });

  it("revisa cada dato de la cita", () => {
    const errors = validateServiceForm(
      filled({
        fields: [
          { ...emptyFieldDraft(), label: "" },
          { ...emptyFieldDraft(), label: "Tela", type: "select", options: "" },
          { ...emptyFieldDraft(), label: "Color", type: "select", options: "Rojo\nRojo" },
          { ...emptyFieldDraft(), label: " tela " },
        ],
      }),
    );
    expect(errors.rows?.[0]?.label).toMatch(/nombre/i);
    expect(errors.rows?.[1]?.options).toMatch(/al menos una/i);
    expect(errors.rows?.[2]?.options).toMatch(/repetirse/i);
    expect(errors.rows?.[3]?.label).toMatch(/ya hay/i);
  });

  it("limita la cantidad de datos", () => {
    const fields = Array.from({ length: 21 }, (_, index) => ({ ...emptyFieldDraft(), label: `Dato ${index}` }));
    expect(validateServiceForm(filled({ fields })).fields).toMatch(/20/);
  });

  it("un número no usa opciones aunque queden escritas", () => {
    const values = filled({ fields: [{ ...emptyFieldDraft(), label: "Piezas", options: "A\nB" }] });
    expect(validateServiceForm(values)).toEqual({});
    const input = createServiceInputFromForm(values);
    expect(input.fields[0].options).toBeUndefined();
    expect(createServiceSchema.safeParse(input).success).toBe(true);
  });
});

describe("datos que se envían", () => {
  it("al crear, omite lo que quedó en blanco", () => {
    const input = createServiceInputFromForm(filled({ description: "  ", internalNotes: "" }));
    expect(input).toMatchObject({ basePriceCents: 12000, durationMin: 45, twoAddresses: false });
    expect(input.description).toBeUndefined();
    expect(input.internalNotes).toBeUndefined();
    expect(createServiceSchema.safeParse(input).success).toBe(true);
  });

  it("al editar, vacía con null lo que se borró", () => {
    const input = updateServiceInputFromForm(filled({ description: "", detailedSpecs: " " }), {
      lockTwoAddresses: false,
    });
    expect(input.description).toBeNull();
    expect(input.detailedSpecs).toBeNull();
    expect(updateServiceSchema.safeParse(input).success).toBe(true);
  });

  it("al editar con citas, no toca las dos direcciones", () => {
    const locked = updateServiceInputFromForm(filled({ twoAddresses: true }), { lockTwoAddresses: true });
    expect("twoAddresses" in locked).toBe(false);
    const open = updateServiceInputFromForm(filled({ twoAddresses: true }), { lockTwoAddresses: false });
    expect(open.twoAddresses).toBe(true);
  });
});

describe("guardado en la base", () => {
  it("crea un servicio con identificador propio", async () => {
    const created = await createService(ctx.db, ADMIN, createServiceInputFromForm(filled({ name: "Tapetes Persas" })));
    expect(created.slug).toBe("tapetes-persas");
    expect(created.basePriceCents).toBe(12000);
  });

  it("un nombre repetido da un error reconocible", async () => {
    await createService(ctx.db, ADMIN, createServiceInputFromForm(filled({ name: "Cortinas" })));
    await expect(
      createService(ctx.db, ADMIN, createServiceInputFromForm(filled({ name: "Cortinas" }))),
    ).rejects.toMatchObject({ code: "slug_taken" });
  });

  it("al editar conserva las claves de los datos aunque se renombren", async () => {
    const created = await createService(
      ctx.db,
      ADMIN,
      createServiceInputFromForm(
        filled({ name: "Sillas", fields: [{ ...emptyFieldDraft(), label: "Cantidad", required: true }] }),
      ),
    );
    const form = serviceFormFromService(created);
    form.fields[0].label = "Número de sillas";
    form.fields.push({ ...emptyFieldDraft(), label: "Cantidad" });
    const updated = await updateService(
      ctx.db,
      ADMIN,
      created.id,
      updateServiceInputFromForm(form, { lockTwoAddresses: false }),
    );
    expect(updated.fields.map((field) => field.key)).toEqual(["cantidad", "cantidad2"]);
    expect(updated.fields[0].label).toBe("Número de sillas");
  });

  it("desactiva y reactiva un servicio", async () => {
    const created = await createService(ctx.db, ADMIN, createServiceInputFromForm(filled({ name: "Cojines" })));
    const form = serviceFormFromService(created);
    await updateService(
      ctx.db,
      ADMIN,
      created.id,
      updateServiceInputFromForm({ ...form, active: false }, { lockTwoAddresses: false }),
    );
    expect((await getService(ctx.db, created.id)).active).toBe(false);
    await updateService(
      ctx.db,
      ADMIN,
      created.id,
      updateServiceInputFromForm({ ...form, active: true }, { lockTwoAddresses: false }),
    );
    expect((await getService(ctx.db, created.id)).active).toBe(true);
  });

  it("cuenta las citas de un servicio", async () => {
    expect(await countServiceAppointments(ctx.db, ctx.services.sofa.id)).toBe(0);
    await createAppointment(ctx.db, ADMIN, appointmentInput(ctx));
    expect(await countServiceAppointments(ctx.db, ctx.services.sofa.id)).toBe(1);
  });

  it("no deja cambiar las dos direcciones si ya hay citas", async () => {
    const service = await getService(ctx.db, ctx.services.sofa.id);
    await expect(
      updateService(ctx.db, ADMIN, service.id, { twoAddresses: !service.twoAddresses }),
    ).rejects.toMatchObject({ code: "service_in_use" });
  });
});

describe("errores del esquema como respaldo", () => {
  it("asigna cada error a su campo", () => {
    const result = createServiceSchema.safeParse({
      name: "",
      category: "x",
      basePriceCents: -1,
      durationMin: 5,
      fields: [
        { key: "a", label: "A", type: "select", required: false },
        { key: "Mal Key", label: "B", type: "number", required: false },
      ],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = serviceFieldErrors(result.error);
    expect(errors.name).toBeDefined();
    expect(errors.price).toBeDefined();
    expect(errors.durationMin).toBeDefined();
    expect(errors.rows?.[0]?.options).toBeDefined();
    expect(errors.rows?.[1]?.label).toBeDefined();
  });
});

describe("listado", () => {
  it("agrupa por categoría en orden alfabético", () => {
    const groups = groupByCategory([
      { category: "Sofás", name: "a" },
      { category: "Alfombras", name: "b" },
      { category: "Sofás", name: "c" },
    ]);
    expect(groups.map(([category]) => category)).toEqual(["Alfombras", "Sofás"]);
    expect(groups[1][1]).toHaveLength(2);
  });

  it("describe la cantidad de datos", () => {
    expect(describeFieldCount(0)).toBe("Sin campos extra");
    expect(describeFieldCount(1)).toBe("1 campo");
    expect(describeFieldCount(3)).toBe("3 campos");
  });
});
