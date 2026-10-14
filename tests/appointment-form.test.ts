import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AGENT_JOSUE } from "@/db/seed-data";
import {
  appointmentFieldErrors,
  appointmentInputFromForm,
  emptyAppointmentForm,
  readAppointmentForm,
  validateSpecs,
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
    serviceId: ctx.services.sofa.id,
    technicianId: ctx.techs[0].id,
    date: "2027-03-10",
    time: "09:30",
    durationMin: "60",
    notes: "  Hay un perro  ",
    spec_sofaType: "Tela",
    spec_seats: "3",
    ...overrides,
  };
}

function errorsFor(entries: Record<string, string>, service = ctx.services.sofa) {
  const values = readAppointmentForm(formData(entries));
  const input = appointmentInputFromForm(values, service);
  const parsed = createAppointmentSchema.safeParse(input);
  return {
    ...validateSpecs(values, service.fields),
    ...(parsed.success ? {} : appointmentFieldErrors(parsed.error.issues)),
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
  it("convierte hora, duración y especificaciones", () => {
    const values = readAppointmentForm(formData(sofaForm()));
    const input = appointmentInputFromForm(values, ctx.services.sofa);
    expect(input.startMin).toBe(570);
    expect(input.durationMin).toBe(60);
    expect(input.specs).toEqual({ sofaType: "Tela", seats: 3 });
    expect(input.notes).toBe("Hay un perro");
    expect(input.destinationAddress).toBeUndefined();
    expect(createAppointmentSchema.safeParse(input).success).toBe(true);
  });

  it("omite las especificaciones vacías", () => {
    const values = readAppointmentForm(formData(sofaForm({ spec_seats: "  " })));
    expect(appointmentInputFromForm(values, ctx.services.sofa).specs).toEqual({ sofaType: "Tela" });
  });

  it("arma la dirección de entrega cuando el servicio la usa", () => {
    const values = readAppointmentForm(
      formData(
        sofaForm({
          serviceId: ctx.services["rug-pickup"].id,
          dest_line1: " 99 Warehouse Rd ",
          dest_city: "Miami",
          dest_state: "",
          dest_zip: "33126",
        }),
      ),
    );
    const input = appointmentInputFromForm(values, ctx.services["rug-pickup"]);
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
      sofaForm({ customerId: "", addressId: "", serviceId: "", technicianId: "", date: "2027-13-40" }),
    );
    expect(errors.customerId).toBe("Elige un cliente");
    expect(errors.addressId).toBe("Elige la dirección del servicio");
    expect(errors.serviceId).toBe("Elige un servicio");
    expect(errors.technicianId).toBe("Elige un técnico");
    expect(errors.date).toBe("Elige una fecha válida");
  });

  it("valida la hora y la duración", () => {
    expect(errorsFor(sofaForm({ time: "" })).time).toBe("Elige una hora válida");
    expect(errorsFor(sofaForm({ time: "25:00" })).time).toBe("Elige una hora válida");
    expect(errorsFor(sofaForm({ durationMin: "" })).durationMin).toMatch(/entre 15 y 720/);
    expect(errorsFor(sofaForm({ durationMin: "5" })).durationMin).toMatch(/entre 15 y 720/);
    expect(errorsFor(sofaForm({ durationMin: "900" })).durationMin).toMatch(/entre 15 y 720/);
  });

  it("valida las especificaciones del servicio", () => {
    expect(errorsFor(sofaForm({ spec_sofaType: "" })).spec_sofaType).toBe("Este campo es obligatorio");
    expect(errorsFor(sofaForm({ spec_sofaType: "Madera" })).spec_sofaType).toBe("Elige una de las opciones");
    expect(errorsFor(sofaForm({ spec_seats: "tres" })).spec_seats).toBe("Escribe un número válido");
    expect(errorsFor(sofaForm({ spec_seats: "-2" })).spec_seats).toBe("Escribe un número válido");
  });

  it("exige la dirección de entrega solo en servicios con dos direcciones", () => {
    const pickup = ctx.services["rug-pickup"];
    const errors = errorsFor(sofaForm({ serviceId: pickup.id, spec_sofaType: "", spec_seats: "" }), pickup);
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
    const values = readAppointmentForm(formData(sofaForm({ date: "2027-03-11" })));
    const input = appointmentInputFromForm(values, ctx.services.sofa);
    const { appointment, conflicts } = await createAppointment(ctx.db, AGENT_JOSUE, input);
    expect(appointment.startMin).toBe(570);
    expect(appointment.specs).toEqual({ sofaType: "Tela", seats: 3 });
    expect(appointment.notes).toBe("Hay un perro");
    expect(appointment.priceCents).toBe(ctx.services.sofa.basePriceCents);
    expect(conflicts).toHaveLength(0);
  });

  it("avisa del solape pero crea la cita igual", async () => {
    const values = readAppointmentForm(formData(sofaForm({ date: "2027-03-12", time: "09:00" })));
    const input = appointmentInputFromForm(values, ctx.services.sofa);
    await createAppointment(ctx.db, AGENT_JOSUE, input);
    const overlapping = readAppointmentForm(formData(sofaForm({ date: "2027-03-12", time: "09:30" })));
    const second = await createAppointment(
      ctx.db,
      AGENT_JOSUE,
      appointmentInputFromForm(overlapping, ctx.services.sofa),
    );
    expect(second.appointment.id).toBeTruthy();
    expect(second.conflicts.length).toBeGreaterThan(0);
  });

  it("crea una cita con dos direcciones", async () => {
    const pickup = ctx.services["rug-pickup"];
    const values = readAppointmentForm(
      formData({
        ...sofaForm({ serviceId: pickup.id, date: "2027-03-13", durationMin: "30" }),
        dest_line1: "99 Warehouse Rd",
        dest_city: "Miami",
        dest_state: "fl",
        dest_zip: "33126",
      }),
    );
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInputFromForm(values, pickup));
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
