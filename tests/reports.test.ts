import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { appointments } from "@/db/schema";
import { AGENT_JOSUE, AGENT_JUANCHO } from "@/db/seed-data";
import { addDays, enumerateDates, periodBounds, todayIn } from "@/domain/date-rules";
import { reportQuerySchema } from "@/domain/schemas";
import { cancelAppointment, createAppointment, markPaid } from "@/server/appointments";
import { getAgentReport } from "@/server/reports";
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

async function book(agent: typeof AGENT_JOSUE | typeof AGENT_JUANCHO, createdAt: string, overrides = {}) {
  const { appointment } = await createAppointment(ctx.db, agent, appointmentInput(ctx, overrides));
  await ctx.db
    .update(appointments)
    .set({ createdAt: new Date(createdAt) })
    .where(eq(appointments.id, appointment.id));
  return appointment;
}

describe("reglas de fecha para reportes", () => {
  it("suma días y enumera rangos incluyendo ambos extremos", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(enumerateDates("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("calcula el período de un día, una semana (domingo a sábado) y un mes", () => {
    expect(periodBounds("day", "2026-10-07")).toEqual({ from: "2026-10-07", to: "2026-10-07" });
    expect(periodBounds("week", "2026-10-07")).toEqual({ from: "2026-10-04", to: "2026-10-10" });
    expect(periodBounds("week", "2026-10-04")).toEqual({ from: "2026-10-04", to: "2026-10-10" });
    expect(periodBounds("month", "2026-10-07")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodBounds("month", "2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("calcula hoy en la zona horaria de Miami y no en UTC", () => {
    const lateNightMiami = new Date("2026-10-08T02:30:00Z");
    expect(todayIn("America/New_York", lateNightMiami)).toBe("2026-10-07");
    expect(todayIn("UTC", lateNightMiami)).toBe("2026-10-08");
  });
});

describe("esquema de consulta del reporte", () => {
  it("acepta período más fecha, o desde y hasta", () => {
    expect(reportQuerySchema.parse({ period: "week", date: "2026-10-07" })).toMatchObject({
      from: "2026-10-04",
      to: "2026-10-10",
    });
    expect(reportQuerySchema.parse({ from: "2026-10-01", to: "2026-10-15" })).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-15",
    });
  });

  it("rechaza combinaciones incompletas, rangos invertidos y rangos demasiado largos", () => {
    expect(() => reportQuerySchema.parse({})).toThrow(ZodError);
    expect(() => reportQuerySchema.parse({ period: "month" })).toThrow(ZodError);
    expect(() => reportQuerySchema.parse({ from: "2026-10-01" })).toThrow(ZodError);
    expect(() => reportQuerySchema.parse({ from: "2026-10-10", to: "2026-10-01" })).toThrow(ZodError);
    expect(() => reportQuerySchema.parse({ from: "2026-01-01", to: "2026-04-04" })).toThrow(ZodError);
    expect(() => reportQuerySchema.parse({ from: "2026-01-01", to: "2026-04-03" })).not.toThrow();
  });
});

describe("reporte por agente", () => {
  const range = { from: "2027-03-08", to: "2027-03-12" };

  beforeAll(async () => {
    await book(AGENT_JOSUE, "2027-03-08T15:00:00Z");
    await book(AGENT_JOSUE, "2027-03-08T16:00:00Z");
    await book(AGENT_JOSUE, "2027-03-10T15:00:00Z");
    await book(AGENT_JUANCHO, "2027-03-10T18:00:00Z");
    await book(AGENT_JOSUE, "2027-03-01T15:00:00Z");
    await book(AGENT_JOSUE, "2027-03-20T15:00:00Z");
  });

  it("cuenta las citas agendadas por agente y por día, rellenando con ceros", async () => {
    const report = await getAgentReport(ctx.db, ADMIN, range);
    expect(report.dates).toEqual(["2027-03-08", "2027-03-09", "2027-03-10", "2027-03-11", "2027-03-12"]);

    const josue = report.agents.find((a) => a.agentId === AGENT_JOSUE.id)!;
    const juancho = report.agents.find((a) => a.agentId === AGENT_JUANCHO.id)!;
    expect(josue.daily).toEqual([2, 0, 1, 0, 0]);
    expect(josue.scheduled).toBe(3);
    expect(juancho.daily).toEqual([0, 0, 1, 0, 0]);
    expect(report.totals.daily).toEqual([2, 0, 2, 0, 0]);
    expect(report.totals.scheduled).toBe(4);
  });

  it("no cuenta citas creadas fuera del rango", async () => {
    const report = await getAgentReport(ctx.db, ADMIN, { from: "2027-03-01", to: "2027-03-01" });
    expect(report.totals.scheduled).toBe(1);
    const other = await getAgentReport(ctx.db, ADMIN, { from: "2027-03-13", to: "2027-03-19" });
    expect(other.totals.scheduled).toBe(0);
  });

  it("incluye a los agentes sin actividad con todo en cero", async () => {
    const report = await getAgentReport(ctx.db, ADMIN, { from: "2027-06-01", to: "2027-06-03" });
    expect(report.agents.length).toBeGreaterThanOrEqual(2);
    for (const agent of report.agents) {
      expect(agent.scheduled).toBe(0);
      expect(agent.daily).toEqual([0, 0, 0]);
    }
  });

  it("filtra por agente y falla si el agente no existe", async () => {
    const report = await getAgentReport(ctx.db, ADMIN, { ...range, agentId: AGENT_JUANCHO.id });
    expect(report.agents).toHaveLength(1);
    expect(report.totals.scheduled).toBe(1);
    await expect(
      getAgentReport(ctx.db, ADMIN, { ...range, agentId: "00000000-0000-4000-8000-0000000000ff" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("solo un administrador puede consultarlo", async () => {
    await expect(getAgentReport(ctx.db, AGENT_JOSUE, range)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("día de negocio en horario de Miami", () => {
  it("asigna al día local las citas creadas cerca de la medianoche, con y sin horario de verano", async () => {
    await book(AGENT_JOSUE, "2027-05-10T03:30:00Z");
    await book(AGENT_JOSUE, "2027-05-10T04:00:00Z");
    await book(AGENT_JOSUE, "2027-05-11T03:59:00Z");
    await book(AGENT_JOSUE, "2027-01-10T04:30:00Z");
    await book(AGENT_JOSUE, "2027-01-10T05:00:00Z");

    const summer = await getAgentReport(ctx.db, ADMIN, { from: "2027-05-09", to: "2027-05-11" });
    expect(summer.totals.daily).toEqual([1, 2, 0]);

    const winter = await getAgentReport(ctx.db, ADMIN, { from: "2027-01-09", to: "2027-01-10" });
    expect(winter.totals.daily).toEqual([1, 1]);
  });

  it("respeta el cambio de horario de marzo", async () => {
    await book(AGENT_JOSUE, "2027-03-14T06:30:00Z");
    await book(AGENT_JOSUE, "2027-03-15T03:59:00Z");
    await book(AGENT_JOSUE, "2027-03-15T04:00:00Z");

    const report = await getAgentReport(ctx.db, ADMIN, { from: "2027-03-14", to: "2027-03-15" });
    expect(report.totals.daily).toEqual([2, 1]);
  });
});

describe("dinero del reporte", () => {
  it("suma lo agendado, lo cobrado y lo pendiente sin contar las canceladas", async () => {
    const price = ctx.services.sofa.basePriceCents;
    const paid = await book(AGENT_JUANCHO, "2027-08-02T15:00:00Z", { date: "2027-08-20" });
    await book(AGENT_JUANCHO, "2027-08-02T16:00:00Z", { date: "2027-08-21" });
    const cancelled = await book(AGENT_JUANCHO, "2027-08-02T17:00:00Z", { date: "2027-08-22" });
    const done = await book(AGENT_JUANCHO, "2027-08-02T18:00:00Z", { date: "2027-08-23" });

    await markPaid(ctx.db, AGENT_JUANCHO, paid.id);
    await markPaid(ctx.db, AGENT_JUANCHO, cancelled.id);
    await cancelAppointment(ctx.db, AGENT_JUANCHO, cancelled.id, { reason: "weather" });
    await ctx.db.update(appointments).set({ status: "completed" }).where(eq(appointments.id, done.id));

    const report = await getAgentReport(ctx.db, ADMIN, {
      from: "2027-08-02",
      to: "2027-08-02",
      agentId: AGENT_JUANCHO.id,
    });
    const row = report.agents[0];
    expect(row.scheduled).toBe(4);
    expect(row.cancelled).toBe(1);
    expect(row.completed).toBe(1);
    expect(row.bookedCents).toBe(price * 3);
    expect(row.paidCents).toBe(price);
    expect(row.unpaidCents).toBe(price * 2);
    expect(report.totals).toEqual({
      scheduled: row.scheduled,
      cancelled: row.cancelled,
      completed: row.completed,
      bookedCents: row.bookedCents,
      paidCents: row.paidCents,
      unpaidCents: row.unpaidCents,
      daily: row.daily,
    });
  });

  it("acepta período y fecha de referencia desde parámetros de consulta", async () => {
    const report = await getAgentReport(ctx.db, ADMIN, { period: "month", date: "2027-08-15" });
    expect(report.from).toBe("2027-08-01");
    expect(report.to).toBe("2027-08-31");
    expect(report.totals.scheduled).toBe(4);
    expect(report.timezone).toBe("America/New_York");
  });
});
