import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AGENT_JOSUE } from "@/db/seed-data";
import {
  appointmentFieldErrors,
  appointmentInputFromForm,
  emptyAppointmentForm,
  readAppointmentForm,
} from "@/domain/appointment-form";
import { createAppointmentSchema } from "@/domain/schemas";
import { createAppointment } from "@/server/appointments";
import { getCustomerSummary } from "@/server/customers";
import { createTestDb } from "./helpers";

vi.mock("@/server/geocoding", () => ({
  geocodeIfNeeded: async (address: unknown) => address,
  getGeocoder: () => null,
}));

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;

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

function sofaForm(overrides: Record<string, string> = {}) {
  return {
    customerId: ctx.customer.id,
    addressId: ctx.address.id,
    "items.0.serviceId": ctx.services.sofa.id,
    "items.0.price": "",
    "items.0.spec.sofaType": "Tela",
    "items.0.spec.seats": "3",
    technicianId: ctx.techs[0].id,
    date: "2027-03-10",
    time: "09:30",
    durationMin: "60",
    notes: "  Hay un perro  ",
    ...overrides,
  };
}

function pickupForm(overrides: Record<string, string> = {}) {
  const entries: Record<string, string> = { ...sofaForm(), "items.0.serviceId": ctx.services["rug-pickup"].id };
  delete entries["items.0.spec.sofaType"];
  delete entries["items.0.spec.seats"];
  return { ...entries, ...overrides };
}

function findService(id: string) {
  return Object.values(ctx.services).find((service) => service.id === id);
}

function inputFor(entries: Record<string, string>) {
  return appointmentInputFromForm(readAppointmentForm(formData(entries)), findService);
}

function errorsFor(entries: Record<string, string>) {
  const { input, itemErrors } = inputFor(entries);
  const parsed = createAppointmentSchema.safeParse(input);
  return {
    ...(parsed.success ? {} : appointmentFieldErrors(parsed.error.issues)),
    ...itemErrors,
  };
}

describe("lectura del formulario de cita", () => {
  it("empieza vacío con Florida en la dirección de entrega", () => {
    const values = emptyAppointmentForm();
    expect(values.date).toBe("");
    expect(values.dest_state).toBe("FL");
  });

  it("lee solo textos y descarta archivos", () => {
    const data = new FormData();
    data.set("notes", "hola");
    data.set("file", new File(["x"], "x.txt"));
    expect(readAppointmentForm(data)).toEqual({ notes: "hola" });
  });
});

describe("entrada de la cita", () => {
  it("convierte hora, duración, servicios y especificaciones", () => {
    const { input, itemErrors } = inputFor(sofaForm());
    expect(itemErrors).toEqual({});
    expect(input.startMin).toBe(570);
    expect(input.durationMin).toBe(60);
    expect(input.items).toEqual([
      { serviceId: ctx.services.sofa.id, specs: { sofaType: "Tela", seats: 3 }, details: {} },
    ]);
    expect(input.notes).toBe("Hay un perro");
    expect(input.destinationAddress).toBeUndefined();
    expect(createAppointmentSchema.safeParse(input).success).toBe(true);
  });

  it("omite las especificaciones vacías y lee el largo y ancho del sofá", () => {
    const { input } = inputFor(
      sofaForm({ "items.0.spec.seats": "  ", "items.0.spec.sofaLength": "84", "items.0.spec.sofaWidth": "36.5" }),
    );
    expect(input.items[0].specs).toEqual({ sofaType: "Tela", sofaLength: 84, sofaWidth: 36.5 });
  });

  it("lee varios servicios con su precio en dólares", () => {
    const { input, itemErrors } = inputFor(
      sofaForm({
        "items.0.price": "$1,150.50",
        "items.1.serviceId": ctx.services.carpet.id,
        "items.1.price": "80",
        "items.1.spec.length": "12",
        "items.1.spec.width": "10",
        "items.1.spec.carpetType": "Lana",
        "items.1.spec.quantity": "1",
      }),
    );
    expect(itemErrors).toEqual({});
    expect(input.items.map((item) => item.priceCents)).toEqual([115050, 8000]);
    expect(input.items[1].serviceId).toBe(ctx.services.carpet.id);
  });

  it("arma la dirección de entrega cuando algún servicio la usa", () => {
    const { input } = inputFor(
      pickupForm({ dest_line1: " 99 Warehouse Rd ", dest_city: "Miami", dest_state: "", dest_zip: "33126" }),
    );
    expect(input.destinationAddress).toEqual({
      line1: "99 Warehouse Rd",
      unit: "",
      city: "Miami",
      state: "FL",
      zip: "33126",
    });
  });
});

describe("errores por campo de la cita", () => {
  it("no hay errores con datos completos", () => {
    expect(errorsFor(sofaForm())).toEqual({});
  });

  it("pide cliente, dirección, servicio, técnico y fecha", () => {
    const errors = errorsFor(
      sofaForm({ customerId: "", addressId: "", "items.0.serviceId": "", technicianId: "", date: "2027-13-40" }),
    );
    expect(errors.customerId).toBe("Elige un cliente");
    expect(errors.addressId).toBe("Elige la dirección del servicio");
    expect(errors["items.0.serviceId"]).toBe("Elige un servicio");
    expect(errors.technicianId).toBe("Elige un técnico");
    expect(errors.date).toBe("Elige una fecha válida");
  });

  it("valida la hora y la duración", () => {
    expect(errorsFor(sofaForm({ time: "" })).time).toBe("Elige una hora válida");
    expect(errorsFor(sofaForm({ time: "25:00" })).time).toBe("Elige una hora válida");
    expect(errorsFor(sofaForm({ durationMin: "" })).durationMin).toMatch(/entre 0 y 720/);
    expect(errorsFor(sofaForm({ durationMin: "0" })).durationMin).toBeUndefined();
    expect(errorsFor(sofaForm({ durationMin: "-5" })).durationMin).toMatch(/entre 0 y 720/);
    expect(errorsFor(sofaForm({ durationMin: "900" })).durationMin).toMatch(/entre 0 y 720/);
  });

  it("valida las especificaciones y el precio de cada servicio", () => {
    expect(errorsFor(sofaForm({ "items.0.spec.sofaType": "" }))["items.0.spec.sofaType"]).toBe(
      "Este campo es obligatorio",
    );
    expect(errorsFor(sofaForm({ "items.0.spec.sofaType": "Madera" }))["items.0.spec.sofaType"]).toBe(
      "Elige una de las opciones",
    );
    expect(errorsFor(sofaForm({ "items.0.spec.seats": "tres" }))["items.0.spec.seats"]).toBe(
      "Escribe un número válido",
    );
    expect(errorsFor(sofaForm({ "items.0.spec.sofaLength": "-2" }))["items.0.spec.sofaLength"]).toBe(
      "Escribe un número válido",
    );
    expect(errorsFor(sofaForm({ "items.0.price": "abc" }))["items.0.price"]).toMatch(/precio válido/);
  });

  it("exige la dirección de entrega solo en servicios con dos direcciones", () => {
    const errors = errorsFor(pickupForm());
    expect(errors.dest_line1).toBe("Este campo es obligatorio");
    expect(errors.dest_city).toBe("Este campo es obligatorio");
    expect(errors.dest_zip).toBe("Este campo es obligatorio");
    expect(errors.dest_state).toBeUndefined();
    expect(errorsFor(sofaForm())).not.toHaveProperty("dest_line1");
  });

  it("ignora problemas que no pertenecen a ningún campo", () => {
    expect(appointmentFieldErrors([{ path: ["specs", "seats"] }, { path: [] }])).toEqual({});
  });
});

describe("crear la cita desde el formulario", () => {
  it("guarda la cita con la hora y las especificaciones del formulario", async () => {
    const { input } = inputFor(sofaForm({ date: "2027-03-11" }));
    const { appointment, conflicts } = await createAppointment(ctx.db, AGENT_JOSUE, input);
    expect(appointment.startMin).toBe(570);
    expect(appointment.specs).toEqual({ sofaType: "Tela", seats: 3 });
    expect(appointment.notes).toBe("Hay un perro");
    expect(appointment.priceCents).toBe(ctx.services.sofa.basePriceCents);
    expect(conflicts).toHaveLength(0);
  });

  it("avisa del solape pero crea la cita igual", async () => {
    await createAppointment(ctx.db, AGENT_JOSUE, inputFor(sofaForm({ date: "2027-03-12", time: "09:00" })).input);
    const second = await createAppointment(
      ctx.db,
      AGENT_JOSUE,
      inputFor(sofaForm({ date: "2027-03-12", time: "09:30" })).input,
    );
    expect(second.appointment.id).toBeTruthy();
    expect(second.conflicts.length).toBeGreaterThan(0);
  });

  it("crea una cita con dos direcciones", async () => {
    const { input } = inputFor(
      pickupForm({
        date: "2027-03-13",
        durationMin: "30",
        dest_line1: "99 Warehouse Rd",
        dest_city: "Miami",
        dest_state: "fl",
        dest_zip: "33126",
      }),
    );
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, input);
    expect(appointment.destinationAddress?.state).toBe("FL");
  });
});

describe("resumen del cliente para el formulario", () => {
  it("devuelve datos de contacto y direcciones", async () => {
    const summary = await getCustomerSummary(ctx.db, ctx.customer.id);
    expect(summary?.id).toBe(ctx.customer.id);
    expect(summary?.addresses.length).toBeGreaterThan(0);
    expect(summary?.addresses[0]).toHaveProperty("line1");
    expect(summary).not.toHaveProperty("email");
  });

  it("devuelve nulo si el cliente no existe", async () => {
    expect(await getCustomerSummary(ctx.db, "00000000-0000-4000-8000-000000000099")).toBeNull();
  });
});

describe("entrega de alfombras en Nueva cita", () => {
  const rug = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "RUGS",
    category: "Alfombras",
    basePriceCents: 9000,
    durationMin: 60,
    twoAddresses: false,
    fields: [],
  };
  const sofa = { ...rug, id: "22222222-2222-4222-8222-222222222222", name: "SOFA", category: "Sofás" };
  const find = (id: string) => [rug, sofa].find((service) => service.id === id);
  const base = {
    customerId: "c",
    addressId: "a",
    technicianId: "t",
    date: "2026-11-02",
    time: "09:00",
    durationMin: "60",
  };

  it("programa la entrega si hay alfombras y se eligió fecha", () => {
    const { input } = appointmentInputFromForm(
      {
        ...base,
        "items.0.serviceId": rug.id,
        "items.0.price": "90",
        deliveryDate: "2026-11-05",
        deliveryTime: "14:30",
        deliveryDuration: "30",
        deliveryTechnicianId: "t2",
      },
      find,
    );
    expect(input).toMatchObject({
      delivery: { date: "2026-11-05", startMin: 870, durationMin: 30, technicianId: "t2" },
    });
    expect(input.destinationAddress).toBeUndefined();
  });

  it("sin alfombras ignora la entrega", () => {
    const { input } = appointmentInputFromForm(
      { ...base, "items.0.serviceId": sofa.id, "items.0.price": "90", deliveryDate: "2026-11-05" },
      find,
    );
    expect("delivery" in input).toBe(false);
  });

  it("usa otra dirección de entrega solo si se escribió", () => {
    const { input } = appointmentInputFromForm(
      {
        ...base,
        "items.0.serviceId": rug.id,
        "items.0.price": "90",
        dest_line1: "1200 Brickell Ave",
        dest_city: "Miami",
        dest_zip: "33131",
      },
      find,
    );
    expect(input.destinationAddress).toMatchObject({ line1: "1200 Brickell Ave", city: "Miami" });
  });
});
