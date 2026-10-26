import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AGENT_JOSUE } from "@/db/seed-data";
import { priceForSize, vehicleName, vehicleSchema, vehicleSummary } from "@/domain/vehicles";
import { createAppointment, getAppointment, updateAppointmentItems } from "@/server/appointments";
import { createCustomer, mergeCustomers } from "@/server/customers";
import { createVehicle, deleteVehicle, listVehicles, updateVehicle } from "@/server/vehicles";
import { appointmentInput, createTestDb } from "./helpers";

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

const ADMIN = { id: AGENT_JOSUE.id, name: "Admin", role: "admin" as const };

describe("reglas de vehículos", () => {
  it("arma un nombre legible y no repite el tipo", () => {
    const camry = { make: "Toyota", model: "Camry", year: 2021, color: "Blanco", plate: "ABC123", size: "sedan" };
    expect(vehicleName(camry)).toBe("Toyota Camry 2021");
    expect(vehicleSummary(camry)).toBe("Toyota Camry 2021 · Blanco · Placa ABC123 · Sedán / coupé");
    expect(vehicleName({ make: "", model: "", year: null, color: "", plate: "", size: "suv" })).toBe("SUV");
  });

  it("usa el precio del tamaño si existe y si no el precio base", () => {
    const service = { basePriceCents: 15000, sizePrices: { suv: 18000 } };
    expect(priceForSize(service, "suv")).toBe(18000);
    expect(priceForSize(service, "pickup")).toBe(15000);
    expect(priceForSize(service, null)).toBe(15000);
  });

  it("valida el año y pone la placa en mayúsculas", () => {
    expect(vehicleSchema.parse({ plate: " abc123 ", year: "2020" })).toMatchObject({ plate: "ABC123", year: 2020 });
    expect(vehicleSchema.parse({ year: "" }).year).toBeNull();
    expect(() => vehicleSchema.parse({ year: 1800 })).toThrow();
  });
});

describe("vehículos del cliente", () => {
  it("crea, lista, edita y borra", async () => {
    const created = await createVehicle(ctx.db, ctx.customer.id, { make: "Honda", model: "Civic", size: "sedan" });
    const updated = await updateVehicle(ctx.db, ctx.customer.id, created.id, {
      make: "Honda",
      model: "Civic",
      color: "Gris",
      size: "sedan",
    });
    expect(updated.color).toBe("Gris");
    expect((await listVehicles(ctx.db, ctx.customer.id)).map((v) => v.id)).toContain(created.id);
    await deleteVehicle(ctx.db, ctx.customer.id, created.id);
    expect((await listVehicles(ctx.db, ctx.customer.id)).map((v) => v.id)).not.toContain(created.id);
  });

  it("guarda el vehículo en cada servicio de la cita y lo conserva al editar", async () => {
    const suv = await createVehicle(ctx.db, ctx.customer.id, { make: "Ford", model: "Explorer", size: "suv" });
    const { appointment } = await createAppointment(
      ctx.db,
      AGENT_JOSUE,
      appointmentInput(ctx, {
        date: "2026-12-01",
        items: [{ serviceId: ctx.services.sofa.id, specs: { sofaType: "Tela", seats: 3 }, vehicleId: suv.id }],
      }),
    );
    let detail = await getAppointment(ctx.db, appointment.id);
    expect(detail.items[0].vehicleId).toBe(suv.id);

    await updateAppointmentItems(ctx.db, AGENT_JOSUE, appointment.id, {
      items: [
        {
          serviceId: ctx.services.sofa.id,
          specs: { sofaType: "Tela", seats: 3 },
          priceCents: 9900,
          vehicleId: suv.id,
        },
      ],
    });
    detail = await getAppointment(ctx.db, appointment.id);
    expect(detail.items[0]).toMatchObject({ vehicleId: suv.id, priceCents: 9900 });
  });

  it("no acepta el vehículo de otro cliente", async () => {
    const other = await createCustomer(ctx.db, {
      firstName: "Otro",
      lastName: "Cliente",
      phone: "407 555 0199",
      addresses: [{ line1: "1 Main St", unit: "", city: "Orlando", state: "FL", zip: "32801" }],
    });
    const foreign = await createVehicle(ctx.db, other.customer.id, { size: "pickup" });
    await expect(
      createAppointment(
        ctx.db,
        AGENT_JOSUE,
        appointmentInput(ctx, {
          date: "2026-12-02",
          items: [{ serviceId: ctx.services.sofa.id, specs: { sofaType: "Tela", seats: 3 }, vehicleId: foreign.id }],
        }),
      ),
    ).rejects.toMatchObject({ code: "vehicle_mismatch" });
  });

  it("al unir clientes los vehículos pasan al que se queda", async () => {
    const keep = await createCustomer(ctx.db, {
      firstName: "Ana",
      lastName: "Ruiz",
      phone: "407 555 0110",
      addresses: [{ line1: "2 Main St", unit: "", city: "Orlando", state: "FL", zip: "32801" }],
    });
    const dup = await createCustomer(ctx.db, {
      firstName: "Ana",
      lastName: "Ruiz B",
      phone: "407 555 0111",
      addresses: [{ line1: "3 Main St", unit: "", city: "Orlando", state: "FL", zip: "32801" }],
    });
    const car = await createVehicle(ctx.db, dup.customer.id, { make: "Kia", size: "sedan" });
    await mergeCustomers(ctx.db, ADMIN, dup.customer.id, keep.customer.id);
    expect((await listVehicles(ctx.db, keep.customer.id)).map((v) => v.id)).toContain(car.id);
  });
});
