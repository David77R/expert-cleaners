import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AGENT_JOSUE } from "@/db/seed-data";
import {
  advanceInvoice,
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  createAppointment,
  markPaid,
} from "@/server/appointments";
import { CHART_FUTURE_DAYS, CHART_PAST_DAYS, getDashboard } from "@/server/dashboard";
import { appointmentInput, createTestDb } from "./helpers";

vi.mock("@/server/geocoding", () => ({
  geocodeIfNeeded: async (address: unknown) => address,
  getGeocoder: () => null,
}));

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;
const TODAY = "2027-05-12";

beforeAll(async () => {
  ctx = await createTestDb();
  const make = (overrides: Record<string, unknown>) =>
    createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, overrides));

  const first = await make({ date: TODAY, startMin: 540, durationMin: 120 });
  await confirmAppointment(ctx.db, AGENT_JOSUE, first.appointment.id);
  const second = await make({ date: TODAY, startMin: 600, durationMin: 60 });
  await completeAppointment(ctx.db, AGENT_JOSUE, second.appointment.id);
  const cancelled = await make({ date: TODAY, startMin: 900 });
  await cancelAppointment(ctx.db, AGENT_JOSUE, cancelled.appointment.id, { reason: "weather" });

  const paid = await make({
    date: "2027-05-03",
    serviceId: undefined,
    items: [
      { serviceId: ctx.services.sofa.id, specs: { sofaType: "Tela", seats: 3 }, priceCents: 20000 },
      { serviceId: ctx.services.sofa.id, specs: { sofaType: "Tela", seats: 1 }, priceCents: 5000 },
    ],
  });
  await markPaid(ctx.db, AGENT_JOSUE, paid.appointment.id);
  await advanceInvoice(ctx.db, AGENT_JOSUE, paid.appointment.id);

  await make({ date: "2027-05-14", technicianId: ctx.techs[1].id });
  await make({
    date: "2027-05-10",
    delivery: { date: TODAY, startMin: 840, durationMin: 30, technicianId: ctx.techs[1].id },
  });
  await make({ date: "2027-04-28" });
});

afterAll(async () => {
  await ctx.client.close();
});

describe("dashboard principal", () => {
  it("cuenta las citas de hoy por estado sin las canceladas y las entregas del día", async () => {
    const data = await getDashboard(ctx.db, TODAY);
    expect(data.todayCount).toBe(2);
    expect(data.status).toMatchObject({ confirmed: 1, completed: 1, notConfirmed: 0 });
    expect(data.deliveryCount).toBe(1);
    expect(data.agenda.map((entry) => entry.kind ?? "cita")).toEqual(["cita", "cita", "delivery"]);
  });

  it("arma la serie diaria de dos semanas atrás a una semana adelante", async () => {
    const data = await getDashboard(ctx.db, TODAY);
    expect(data.daily).toHaveLength(CHART_PAST_DAYS + CHART_FUTURE_DAYS + 1);
    const byDate = Object.fromEntries(data.daily.map((day) => [day.date, day.total]));
    expect(byDate[TODAY]).toBe(2);
    expect(byDate["2027-05-14"]).toBe(1);
    expect(byDate["2027-05-03"]).toBe(1);
    expect(byDate["2027-04-28"]).toBeUndefined();
  });

  it("suma lo vendido y cobrado del mes, lo pendiente de cobro y los servicios más pedidos", async () => {
    const data = await getDashboard(ctx.db, TODAY);
    const base = ctx.services.sofa.basePriceCents;
    expect(data.monthCount).toBe(5);
    expect(data.monthRevenueCents).toBe(25000 + base * 4);
    expect(data.monthPaidCents).toBe(25000);
    expect(data.unpaidCount).toBe(1);
    expect(data.unpaidCents).toBe(base);
    expect(data.pendingWeek).toBe(1);
    expect(data.topServices[0]).toMatchObject({ name: ctx.services.sofa.name, total: 6 });
  });

  it("calcula la carga de cada técnico hoy contando las entregas", async () => {
    const data = await getDashboard(ctx.db, TODAY);
    const first = data.technicianLoad.find((tech) => tech.id === ctx.techs[0].id);
    const second = data.technicianLoad.find((tech) => tech.id === ctx.techs[1].id);
    expect(first).toMatchObject({ visits: 2, minutes: 180 });
    expect(second).toMatchObject({ visits: 1, minutes: 30 });
    expect(first?.capacity).toBeGreaterThan(0);
  });
});
