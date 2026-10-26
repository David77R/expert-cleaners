import { eq } from "drizzle-orm";
import { EXPERT_CLEANERS_COMPANY_ID } from "@/domain/companies";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { appointments } from "@/db/schema";
import { AGENT_JOSUE, AGENT_JUANCHO } from "@/db/seed-data";
import { enumerateDates } from "@/domain/date-rules";
import { createAppointment } from "@/server/appointments";
import { fitText, formatPeriod, labelStep, renderReportPdf, sortAgents } from "@/server/report-pdf";
import { getAgentReportPdf, type AgentReport, type ReportMetrics } from "@/server/reports";
import { appointmentInput, createTestDb } from "./helpers";
import { hexOf, loadPdf, pageText } from "./pdf-helpers";

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;

const ADMIN = { id: AGENT_JOSUE.id, name: "Admin", role: "admin" as const, companyId: EXPERT_CLEANERS_COMPANY_ID };
const GENERATED_AT = new Date("2026-10-07T18:30:00Z");

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.client.close();
});

function metrics(daily: number[]): ReportMetrics {
  const scheduled = daily.reduce((sum, value) => sum + value, 0);
  const booked = scheduled * 11000;
  return {
    scheduled,
    cancelled: 3,
    completed: 5,
    bookedCents: booked,
    paidCents: booked / 2,
    unpaidCents: booked / 2,
    daily,
  };
}

function buildReport(from: string, to: string, names: string[]): AgentReport {
  const dates = enumerateDates(from, to);
  const agents = names.map((name, index) => ({
    agentId: `agent-${index}`,
    name,
    role: "agent" as const,
    ...metrics(dates.map((_, day) => ((day * 7 + index * 3) % 6) + 2)),
  }));
  const totals = metrics(dates.map((_, day) => agents.reduce((sum, agent) => sum + agent.daily[day], 0)));
  return { from, to, timezone: "America/New_York", dates, agents, totals };
}

describe("ayudas del reporte en PDF", () => {
  it("formatea el período de un día y de un rango", () => {
    expect(formatPeriod("2026-10-07", "2026-10-07")).toBe("7 de octubre de 2026");
    expect(formatPeriod("2026-10-01", "2026-10-31")).toBe("1 de octubre de 2026 al 31 de octubre de 2026");
  });

  it("limita las etiquetas del eje a un máximo razonable", () => {
    expect(labelStep(7)).toBe(1);
    expect(labelStep(12)).toBe(1);
    expect(labelStep(31)).toBe(3);
    expect(labelStep(93)).toBe(8);
  });

  it("ordena los agentes por citas agendadas y luego por nombre", () => {
    const sorted = sortAgents([
      { name: "Beto", scheduled: 5 },
      { name: "Ana", scheduled: 5 },
      { name: "Zoe", scheduled: 9 },
    ]);
    expect(sorted.map((agent) => agent.name)).toEqual(["Zoe", "Ana", "Beto"]);
  });

  it("recorta nombres largos con puntos suspensivos y conserva los cortos", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    expect(fitText("Ana", font, 10, 100)).toBe("Ana");
    const shortened = fitText("Agente con un nombre extremadamente largo", font, 10, 80);
    expect(shortened.endsWith("...")).toBe(true);
    expect(font.widthOfTextAtSize(shortened, 10)).toBeLessThanOrEqual(80);
  });
});

describe("PDF del reporte", () => {
  it("genera un PDF válido con metadatos del negocio y la fecha de generación", async () => {
    const bytes = await renderReportPdf(
      buildReport("2026-10-01", "2026-10-31", ["Josué Perfecto", "Juancho"]),
      GENERATED_AT,
    );
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");

    const pdf = await loadPdf(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("Reporte por agente 2026-10-01 a 2026-10-31");
    expect(pdf.getProducer()).toBe("Expert Cleaners");
    expect(pdf.getCreationDate()?.toISOString()).toBe(GENERATED_AT.toISOString());
  });

  it("muestra el período, los agentes, el total y la nota de cálculo", async () => {
    const text = await pageText(
      await renderReportPdf(buildReport("2026-10-01", "2026-10-31", ["Josué Perfecto", "Zoë Núñez"]), GENERATED_AT),
    );
    for (const expected of [
      "REPORTE",
      "1 de octubre de 2026",
      "octubre de 2026",
      "Todos los agentes",
      "Josué Perfecto",
      "Zoë Núñez",
      "Total",
      "horario de Miami",
      "Página 1 de 1",
    ]) {
      expect(text).toContain(hexOf(expected));
    }
  });

  it("con un solo agente muestra su nombre y omite la fila de total", async () => {
    const text = await pageText(
      await renderReportPdf(buildReport("2026-10-07", "2026-10-07", ["Josué Perfecto"]), GENERATED_AT),
    );
    expect(text).toContain(hexOf("Josué Perfecto"));
    expect(text).not.toContain(hexOf("Todos los agentes"));
    expect(text).not.toContain(hexOf("Total"));
  });

  it("reemplaza caracteres no soportados sin romper la generación", async () => {
    const bytes = await renderReportPdf(buildReport("2026-10-07", "2026-10-07", ["Zoë 😀"]), GENERATED_AT);
    const text = await pageText(bytes);
    expect(text).toContain(hexOf("Zoë ?"));
  });

  it("pagina muchos agentes repitiendo el encabezado y numerando cada página", async () => {
    const names = Array.from({ length: 30 }, (_, index) => `Agente ${String(index + 1).padStart(2, "0")}`);
    const bytes = await renderReportPdf(buildReport("2026-10-01", "2026-10-31", names), GENERATED_AT);
    const pdf = await loadPdf(bytes);
    const total = pdf.getPageCount();
    expect(total).toBeGreaterThan(1);

    for (let index = 1; index < total; index += 1) {
      const text = await pageText(bytes, index);
      expect(text).toContain(hexOf("AGENTE"));
    }
    for (let index = 0; index < total; index += 1) {
      expect(await pageText(bytes, index)).toContain(hexOf(`Página ${index + 1} de ${total}`));
    }
  });

  it("nunca deja la fila de total sola en una página", async () => {
    const names = Array.from({ length: 6 }, (_, index) => `Agente ${index + 1}`);
    const bytes = await renderReportPdf(buildReport("2026-07-01", "2026-09-30", names), GENERATED_AT);
    const pdf = await loadPdf(bytes);
    const last = await pageText(bytes, pdf.getPageCount() - 1);
    expect(last).toContain(hexOf("Total"));
    expect(last).toContain(hexOf("Agente "));
  });

  it("produce exactamente los mismos bytes con los mismos datos", async () => {
    const report = buildReport("2026-10-01", "2026-10-07", ["Josué Perfecto", "Juancho"]);
    const first = await renderReportPdf(report, GENERATED_AT);
    const second = await renderReportPdf(report, GENERATED_AT);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });

  it("acepta rangos de un día hasta tres meses", async () => {
    for (const [from, to] of [
      ["2026-10-07", "2026-10-07"],
      ["2026-07-01", "2026-09-30"],
    ]) {
      const bytes = await renderReportPdf(buildReport(from, to, ["Josué Perfecto", "Juancho"]), GENERATED_AT);
      expect((await loadPdf(bytes)).getPageCount()).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("reporte en PDF con datos reales", () => {
  beforeAll(async () => {
    for (const [agent, createdAt] of [
      [AGENT_JOSUE, "2027-03-08T15:00:00Z"],
      [AGENT_JOSUE, "2027-03-08T16:00:00Z"],
      [AGENT_JUANCHO, "2027-03-09T15:00:00Z"],
    ] as const) {
      const { appointment } = await createAppointment(ctx.db, agent, appointmentInput(ctx));
      await ctx.db
        .update(appointments)
        .set({ createdAt: new Date(createdAt) })
        .where(eq(appointments.id, appointment.id));
    }
  });

  it("devuelve el reporte y su PDF con los nombres reales de los agentes", async () => {
    const { report, pdf } = await getAgentReportPdf(
      ctx.db,
      ADMIN,
      { from: "2027-03-08", to: "2027-03-12" },
      GENERATED_AT,
    );
    expect(report.totals.scheduled).toBe(3);

    const text = await pageText(pdf);
    expect(text).toContain(hexOf(AGENT_JOSUE.name));
    expect(text).toContain(hexOf(AGENT_JUANCHO.name));
    expect(text).toContain(hexOf("8 de marzo de 2027"));
  });

  it("filtra por agente y lo refleja en el PDF", async () => {
    const { pdf } = await getAgentReportPdf(
      ctx.db,
      ADMIN,
      { period: "week", date: "2027-03-09", agentId: AGENT_JUANCHO.id },
      GENERATED_AT,
    );
    const text = await pageText(pdf);
    expect(text).toContain(hexOf(AGENT_JUANCHO.name));
    expect(text).not.toContain(hexOf("Todos los agentes"));
  });

  it("un agente también puede descargarlo y se validan los parámetros", async () => {
    const { pdf } = await getAgentReportPdf(
      ctx.db,
      AGENT_JOSUE,
      { from: "2027-03-08", to: "2027-03-12" },
      GENERATED_AT,
    );
    expect(pdf.byteLength).toBeGreaterThan(0);
    await expect(getAgentReportPdf(ctx.db, AGENT_JOSUE, {}, GENERATED_AT)).rejects.toBeInstanceOf(ZodError);
  });
});
