import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getAppointment } from "@/server/appointments";
import {
  BOOKING_AGENT,
  bookingAvailability,
  bookingServices,
  createBooking,
  type BookingInput,
} from "@/server/booking";
import { listVehicles } from "@/server/vehicles";
import { services } from "@/db/schema";
import { createTestDb } from "./helpers";

vi.mock("@/config/clients", async (original) => {
  const actual = await original<typeof import("@/config/clients")>();
  return { ...actual, client: actual.CLIENTS.rva };
});

vi.mock("@/server/geocoding", () => ({
  geocodeIfNeeded: async (address: unknown) => address,
  getGeocoder: () => null,
}));

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;

const NOW = new Date("2026-11-02T13:00:00Z");
const MONDAY_NEXT = "2026-11-09";

let washId = "";

beforeAll(async () => {
  ctx = await createTestDb();
  const [wash] = await ctx.db
    .insert(services)
    .values({
      slug: "premium-wash",
      name: "Premium",
      category: "Lavado",
      basePriceCents: 22000,
      durationMin: 120,
      sizePrices: { suv: 24000 },
    })
    .returning();
  washId = wash.id;
});

afterAll(async () => {
  await ctx.client.close();
});

function booking(overrides: Partial<BookingInput> = {}): BookingInput {
  return {
    serviceId: washId,
    size: "suv",
    make: "Toyota",
    model: "RAV4",
    color: "Gris",
    date: MONDAY_NEXT,
    startMin: 600,
    firstName: "Carla",
    lastName: "Gómez",
    phone: "(407) 555-0123",
    email: "carla@example.com",
    line1: "100 N Orange Ave",
    unit: "",
    city: "Orlando",
    zip: "32801",
    notes: "Portón azul",
    ...overrides,
  };
}

describe("reservas en línea", () => {
  it("lista solo los paquetes que se pueden reservar, del más barato al más caro", async () => {
    const list = await bookingServices(ctx.db);
    const prices = list.map((service) => service.basePriceCents);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(list.map((service) => service.id)).toContain(washId);
    expect(list.map((service) => service.id)).not.toContain(ctx.services.sofa.id);
  });

  it("muestra horas libres y crea la cita sin confirmar con cliente, dirección y vehículo", async () => {
    const before = await bookingAvailability(ctx.db, MONDAY_NEXT, washId, NOW);
    expect(before).toContain(600);

    const result = await createBooking(ctx.db, booking(), NOW);
    expect(result.code).toMatch(/^SVC-/);

    const created = await ctx.db.query.appointments.findFirst({
      where: (a, { eq }) => eq(a.code, result.code),
      with: { customer: true, address: true },
    });
    expect(created).toMatchObject({ status: "not_confirmed", agentId: BOOKING_AGENT.id, notes: "Portón azul" });
    expect(created?.alerts.map((alert) => alert.key)).toContain("online-booking");
    expect(created?.address.city).toBe("Orlando");

    const detail = await getAppointment(ctx.db, created!.id);
    expect(detail.items[0].vehicle).toMatchObject({ make: "Toyota", model: "RAV4", size: "suv" });
    expect(detail.priceCents).toBe(24000);
  });

  it("reutiliza el cliente y el vehículo si vuelve a reservar", async () => {
    await createBooking(ctx.db, booking({ startMin: 840 }), NOW);
    const customer = await ctx.db.query.customers.findFirst({ where: (c, { eq }) => eq(c.email, "carla@example.com") });
    expect(await listVehicles(ctx.db, customer!.id)).toHaveLength(1);
  });

  it("no deja reservar en el pasado ni con el campo trampa lleno", async () => {
    await expect(createBooking(ctx.db, booking({ date: "2026-11-01" }), NOW)).rejects.toMatchObject({
      code: "slot_taken",
    });
    await expect(createBooking(ctx.db, booking({ website: "spam" }), NOW)).rejects.toThrow();
  });
});
