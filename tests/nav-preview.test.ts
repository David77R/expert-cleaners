import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AGENT_JOSUE } from "@/db/seed-data";
import { isNavPreviewSection, splitActive, type PreviewAppointment } from "@/domain/nav-preview";
import { cancelAppointment, completeAppointment, createAppointment } from "@/server/appointments";
import { getNavPreview } from "@/server/nav-preview";
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
  await make({ date: TODAY, startMin: 480, durationMin: 60 });
  await make({ date: TODAY, startMin: 600, durationMin: 120 });
  const done = await make({ date: TODAY, startMin: 720, durationMin: 60, technicianId: ctx.techs[1].id });
  await completeAppointment(ctx.db, AGENT_JOSUE, done.appointment.id);
  const cancelled = await make({ date: TODAY, startMin: 900, durationMin: 60 });
  await cancelAppointment(ctx.db, AGENT_JOSUE, cancelled.appointment.id, { reason: "weather" });
  await make({ date: TODAY, startMin: 960, durationMin: 60, technicianId: ctx.techs[1].id });
  await make({ date: "2027-05-13", startMin: 540 });
});

afterAll(async () => {
  await ctx.client.close();
});

function appointment(startMin: number, durationMin: number, status: PreviewAppointment["status"]): PreviewAppointment {
  return {
    id: `${startMin}-${status}`,
    code: "SVC-1",
    customerName: "Cliente",
    serviceName: "Basic",
    city: "Richmond",
    technicianName: "Técnico 1",
    technicianColor: "#000000",
    startMin,
    durationMin,
    status,
  };
}

describe("secciones con resumen", () => {
  it("solo reconoce los botones de la barra superior", () => {
    expect(isNavPreviewSection("today")).toBe(true);
    expect(isNavPreviewSection("active")).toBe(true);
    expect(isNavPreviewSection("alerts")).toBe(true);
    expect(isNavPreviewSection("customers")).toBe(false);
  });

  it("separa lo que está en curso, lo que sigue y lo que quedó abierto", () => {
    const items = [
      appointment(480, 60, "confirmed"),
      appointment(600, 120, "confirmed"),
      appointment(660, 60, "completed"),
      appointment(900, 60, "not_confirmed"),
      appointment(1000, 60, "cancelled"),
    ];
    const { now, next, late } = splitActive(items, 630);
    expect(now.map((item) => item.startMin)).toEqual([600]);
    expect(next.map((item) => item.startMin)).toEqual([900]);
    expect(late.map((item) => item.startMin)).toEqual([480]);
  });
});

describe("resumen de cada botón", () => {
  it("muestra todas las citas del día en orden, incluidas las canceladas", async () => {
    const preview = await getNavPreview(ctx.db, AGENT_JOSUE, "today", TODAY, 630);
    if (preview.section !== "today") throw new Error("sección equivocada");
    expect(preview.appointments.map((item) => item.startMin)).toEqual([480, 600, 720, 900, 960]);
    expect(preview.appointments.find((item) => item.startMin === 900)?.status).toBe("cancelled");
    expect(preview.appointments[0].technicianName).toBe(ctx.techs[0].name);
  });

  it("deja en servicios activos solo lo que falta por hacer", async () => {
    const preview = await getNavPreview(ctx.db, AGENT_JOSUE, "active", TODAY, 630);
    if (preview.section !== "active") throw new Error("sección equivocada");
    expect(preview.appointments.map((item) => item.startMin)).toEqual([480, 600, 960]);
    expect(preview.nowMin).toBe(630);
  });

  it("agrupa las alertas del día con una muestra de citas", async () => {
    const preview = await getNavPreview(ctx.db, AGENT_JOSUE, "alerts", TODAY, 630);
    if (preview.section !== "alerts") throw new Error("sección equivocada");
    const pending = preview.groups.find((group) => group.type === "not_confirmed");
    expect(pending?.count).toBe(3);
    expect(pending?.appointments.length).toBe(3);
    expect(preview.groups.some((group) => group.type === "completed_unpaid")).toBe(true);
    expect(preview.total).toBe(preview.groups.reduce((sum, group) => sum + group.count, 0));
  });
});
