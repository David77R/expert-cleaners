import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EXPERT_CLEANERS_COMPANY_ID } from "@/domain/companies";
import { ZodError } from "zod";
import { AGENT_JOSUE } from "@/db/seed-data";
import { buildAlerts } from "@/domain/alert-rules";
import { todayIn } from "@/domain/date-rules";
import { getAlerts } from "@/server/alerts";
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  createAppointment,
  markPaid,
  rescheduleAppointment,
} from "@/server/appointments";
import { appointmentInput, createTestDb } from "./helpers";

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.client.close();
});

async function book(overrides: Record<string, unknown>) {
  const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, overrides));
  return appointment;
}

describe("reglas de alertas", () => {
  const day = [
    { id: "a", status: "not_confirmed" as const },
    { id: "b", status: "confirmed" as const },
    { id: "c", status: "not_confirmed" as const },
    { id: "d", status: "rescheduled" as const },
    { id: "e", status: "cancelled" as const },
  ];

  it("no genera alertas cuando no hay nada que atender", () => {
    expect(buildAlerts({ dayAppointments: [], overlapIds: [], unpaidCompletedIds: [] })).toEqual([]);
    expect(
      buildAlerts({
        dayAppointments: [{ id: "x", status: "confirmed" }],
        overlapIds: [],
        unpaidCompletedIds: [],
      }),
    ).toEqual([]);
  });

  it("agrupa por tipo con nivel, cantidad e ids en el orden del día", () => {
    const items = buildAlerts({ dayAppointments: day, overlapIds: ["c", "b"], unpaidCompletedIds: ["z1", "z2"] });
    expect(items).toEqual([
      { type: "not_confirmed", level: "warning", count: 2, appointmentIds: ["a", "c"] },
      { type: "overlap", level: "attention", count: 2, appointmentIds: ["b", "c"] },
      { type: "completed_unpaid", level: "attention", count: 2, appointmentIds: ["z1", "z2"] },
      { type: "rescheduled", level: "info", count: 1, appointmentIds: ["d"] },
    ]);
  });

  it("omite los tipos sin elementos y mantiene el orden de prioridad", () => {
    const items = buildAlerts({ dayAppointments: day, overlapIds: [], unpaidCompletedIds: ["z"] });
    expect(items.map((i) => i.type)).toEqual(["not_confirmed", "completed_unpaid", "rescheduled"]);
  });

  it("las canceladas nunca generan alertas por sí mismas", () => {
    const items = buildAlerts({
      dayAppointments: [{ id: "e", status: "cancelled" }],
      overlapIds: [],
      unpaidCompletedIds: [],
    });
    expect(items).toEqual([]);
  });
});

describe("alertas con datos reales", () => {
  const date = "2027-09-14";

  it("sin datos devuelve una lista vacía", async () => {
    const result = await getAlerts(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { date: "2027-01-05" });
    expect(result).toEqual({ date: "2027-01-05", count: 0, items: [] });
  });

  it("detecta no confirmadas, solapes y reprogramadas del día", async () => {
    const pending = await book({ date, startMin: 480, durationMin: 60 });
    const first = await book({ date, startMin: 600, durationMin: 90 });
    const second = await book({ date, startMin: 630, durationMin: 60 });
    await confirmAppointment(ctx.db, AGENT_JOSUE, first.id);
    await confirmAppointment(ctx.db, AGENT_JOSUE, second.id);

    const moved = await book({ date: "2027-09-01", startMin: 540, technicianId: ctx.techs[1].id });
    await rescheduleAppointment(ctx.db, AGENT_JOSUE, moved.id, {
      date,
      startMin: 900,
      reason: "Cliente solicitó otra fecha",
    });

    const result = await getAlerts(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { date });
    const byType = Object.fromEntries(result.items.map((i) => [i.type, i]));

    expect(byType.not_confirmed.appointmentIds).toEqual([pending.id]);
    expect(new Set(byType.overlap.appointmentIds)).toEqual(new Set([first.id, second.id]));
    expect(byType.rescheduled.appointmentIds).toEqual([moved.id]);
    expect(byType.completed_unpaid).toBeUndefined();
    expect(result.count).toBe(3);
  });

  it("las canceladas no cuentan como solape ni como pendientes", async () => {
    const quietDay = "2027-09-20";
    const a = await book({ date: quietDay, startMin: 540, durationMin: 60 });
    const b = await book({ date: quietDay, startMin: 570, durationMin: 60 });
    await cancelAppointment(ctx.db, AGENT_JOSUE, b.id, { reason: "duplicate" });
    await confirmAppointment(ctx.db, AGENT_JOSUE, a.id);

    const result = await getAlerts(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { date: quietDay });
    expect(result.items).toEqual([]);
  });

  it("acumula completadas sin pagar de días anteriores, sin incluir futuras ni pagadas", async () => {
    const reference = "2027-10-10";
    const oldUnpaid = await book({ date: "2027-10-02", startMin: 540 });
    const recentUnpaid = await book({ date: "2027-10-09", startMin: 540 });
    const paid = await book({ date: "2027-10-08", startMin: 540 });
    const future = await book({ date: "2027-10-15", startMin: 540 });
    const notDone = await book({ date: "2027-10-05", startMin: 540 });

    for (const appointment of [oldUnpaid, recentUnpaid, paid, future]) {
      await completeAppointment(ctx.db, AGENT_JOSUE, appointment.id);
    }
    await markPaid(ctx.db, AGENT_JOSUE, paid.id);
    await confirmAppointment(ctx.db, AGENT_JOSUE, notDone.id);

    const result = await getAlerts(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { date: reference });
    const unpaid = result.items.find((i) => i.type === "completed_unpaid");
    expect(unpaid?.appointmentIds).toEqual([oldUnpaid.id, recentUnpaid.id]);
    expect(unpaid?.count).toBe(2);

    const afterFuture = await getAlerts(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { date: "2027-10-20" });
    expect(afterFuture.items.find((i) => i.type === "completed_unpaid")?.count).toBe(3);
  });

  it("usa el día de hoy en Miami cuando no se envía fecha", async () => {
    const result = await getAlerts(ctx.db, EXPERT_CLEANERS_COMPANY_ID);
    expect(result.date).toBe(todayIn());
  });

  it("rechaza fechas imposibles", async () => {
    await expect(getAlerts(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { date: "2027-02-31" })).rejects.toBeInstanceOf(
      ZodError,
    );
  });
});
