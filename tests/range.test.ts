import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { AGENT_JOSUE } from "@/db/seed-data";
import { daysBetween, isRealDate } from "@/domain/date-rules";
import { dayQuerySchema } from "@/domain/schemas";
import { cancelAppointment, createAppointment, getDay, getRange } from "@/server/appointments";
import { appointmentInput, createTestDb } from "./helpers";

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.client.close();
});

function book(overrides: Record<string, unknown>) {
  return createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, overrides));
}

describe("reglas de fecha", () => {
  it("distingue fechas reales de fechas con formato válido pero imposibles", () => {
    expect(isRealDate("2028-02-29")).toBe(true);
    expect(isRealDate("2027-02-29")).toBe(false);
    expect(isRealDate("2026-13-01")).toBe(false);
    expect(isRealDate("2026-04-31")).toBe(false);
    expect(isRealDate("26-1-1")).toBe(false);
  });

  it("cuenta días entre fechas sin depender del horario de verano", () => {
    expect(daysBetween("2026-03-01", "2026-03-01")).toBe(0);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
  });

  it("el esquema del día rechaza fechas imposibles", () => {
    expect(() => dayQuerySchema.parse({ date: "2026-13-45" })).toThrow(ZodError);
    expect(dayQuerySchema.parse({ date: "2026-12-31" }).date).toBe("2026-12-31");
  });
});

describe("consulta por rango", () => {
  beforeAll(async () => {
    await book({ date: "2027-03-01", startMin: 600, specs: { sofaType: "Tela", seats: 2 } });
    await book({ date: "2027-03-03", startMin: 540 });
    await book({ date: "2027-03-03", startMin: 480, technicianId: ctx.techs[1].id });
    await book({ date: "2027-03-07", startMin: 540 });
    await book({ date: "2027-03-20", startMin: 540 });
  });

  it("incluye ambos extremos, excluye lo de fuera y ordena por fecha y hora", async () => {
    const range = await getRange(ctx.db, { from: "2027-03-01", to: "2027-03-07" });
    expect(range.appointments).toHaveLength(4);
    const keys = range.appointments.map((a) => `${a.date}-${String(a.startMin).padStart(4, "0")}`);
    expect(keys).toEqual([...keys].sort());
    expect(range.appointments.map((a) => a.date)).not.toContain("2027-03-20");
  });

  it("filtra por técnico", async () => {
    const range = await getRange(ctx.db, {
      from: "2027-03-01",
      to: "2027-03-07",
      technicianId: ctx.techs[1].id,
    });
    expect(range.appointments).toHaveLength(1);
    expect(range.appointments[0].technicianId).toBe(ctx.techs[1].id);
  });

  it("cuenta citas por día sin contar las canceladas", async () => {
    const created = await book({ date: "2027-03-10", startMin: 540 });
    await book({ date: "2027-03-10", startMin: 900 });
    await cancelAppointment(ctx.db, AGENT_JOSUE, created.appointment.id, { reason: "weather" });

    const range = await getRange(ctx.db, { from: "2027-03-08", to: "2027-03-14" });
    expect(range.appointments).toHaveLength(2);
    expect(range.countsByDate).toEqual({ "2027-03-10": 1 });
  });

  it("marca solapes solo dentro del mismo día y técnico, e ignora canceladas", async () => {
    const first = await book({ date: "2027-04-05", startMin: 540, durationMin: 90 });
    const second = await book({ date: "2027-04-05", startMin: 600, durationMin: 60 });
    const otherDay = await book({ date: "2027-04-06", startMin: 600, durationMin: 60 });
    const otherTech = await book({
      date: "2027-04-05",
      startMin: 600,
      durationMin: 60,
      technicianId: ctx.techs[2].id,
    });
    const cancelled = await book({ date: "2027-04-05", startMin: 570, durationMin: 30 });
    await cancelAppointment(ctx.db, AGENT_JOSUE, cancelled.appointment.id, { reason: "duplicate" });

    const range = await getRange(ctx.db, { from: "2027-04-05", to: "2027-04-06" });
    expect(new Set(range.overlapIds)).toEqual(new Set([first.appointment.id, second.appointment.id]));
    expect(range.overlapIds).not.toContain(otherDay.appointment.id);
    expect(range.overlapIds).not.toContain(otherTech.appointment.id);
    expect(range.overlapIds).not.toContain(cancelled.appointment.id);
  });

  it("coincide con getDay para un rango de un solo día", async () => {
    const range = await getRange(ctx.db, { from: "2027-04-05", to: "2027-04-05" });
    const day = await getDay(ctx.db, "2027-04-05");
    expect(range.appointments.map((a) => a.id)).toEqual(day.appointments.map((a) => a.id));
    expect(new Set(range.overlapIds)).toEqual(new Set(day.overlapIds));
  });

  it("devuelve vacío cuando no hay citas", async () => {
    const range = await getRange(ctx.db, { from: "2030-01-01", to: "2030-01-31" });
    expect(range).toEqual({ appointments: [], overlapIds: [], countsByDate: {} });
  });

  it("valida el rango: orden, fechas reales y máximo de 42 días", async () => {
    await expect(getRange(ctx.db, { from: "2027-03-07", to: "2027-03-01" })).rejects.toBeInstanceOf(ZodError);
    await expect(getRange(ctx.db, { from: "2027-02-30", to: "2027-03-01" })).rejects.toBeInstanceOf(ZodError);
    await expect(getRange(ctx.db, { from: "2027-03-01" })).rejects.toBeInstanceOf(ZodError);
    await expect(getRange(ctx.db, { from: "2027-03-01", to: "2027-04-11" })).resolves.toBeDefined();
    await expect(getRange(ctx.db, { from: "2027-03-01", to: "2027-04-12" })).rejects.toBeInstanceOf(ZodError);
  });
});
