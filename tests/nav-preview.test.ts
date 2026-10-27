import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AGENT_JOSUE } from "@/db/seed-data";
import { todayIn } from "@/domain/date-rules";
import { canPreview, isNavPreviewSection } from "@/domain/nav-preview";
import { cancelAppointment, createAppointment } from "@/server/appointments";
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
  await make({ date: TODAY, startMin: 540 });
  await make({ date: TODAY, startMin: 660 });
  const cancelled = await make({ date: TODAY, startMin: 900 });
  await cancelAppointment(ctx.db, AGENT_JOSUE, cancelled.appointment.id, { reason: "weather" });
  await make({ date: "2027-05-13", startMin: 540 });
});

afterAll(async () => {
  await ctx.client.close();
});

describe("permisos del resumen", () => {
  it("solo reconoce las secciones con resumen", () => {
    expect(isNavPreviewSection("customers")).toBe(true);
    expect(isNavPreviewSection("calendar")).toBe(false);
    expect(isNavPreviewSection(undefined)).toBe(false);
  });

  it("deja a cada rol ver lo mismo que ve en el menú", () => {
    expect(canPreview({ role: "agent" }, "customers")).toBe(true);
    expect(canPreview({ role: "agent" }, "reports")).toBe(true);
    expect(canPreview({ role: "agent" }, "services")).toBe(false);
    expect(canPreview({ role: "agent" }, "technicians")).toBe(false);
    expect(canPreview({ role: "admin" }, "agents")).toBe(true);
    expect(canPreview({ role: "admin" }, "companies")).toBe(false);
    expect(canPreview({ role: "owner" }, "companies")).toBe(true);
  });
});

describe("resumen de cada sección", () => {
  it("cuenta las citas de hoy de cada técnico sin las canceladas", async () => {
    const preview = await getNavPreview(ctx.db, AGENT_JOSUE, "technicians", TODAY);
    if (preview.section !== "technicians") throw new Error("sección equivocada");
    const first = preview.items.find((technician) => technician.id === ctx.techs[0].id);
    expect(first?.today).toBe(2);
    expect(preview.items.some((technician) => technician.id === ctx.techs[1].id && technician.today === 0)).toBe(true);
  });

  it("muestra el total de clientes y los más recientes", async () => {
    const preview = await getNavPreview(ctx.db, AGENT_JOSUE, "customers", TODAY);
    if (preview.section !== "customers") throw new Error("sección equivocada");
    expect(preview.total).toBeGreaterThan(0);
    expect(preview.recent.length).toBeLessThanOrEqual(6);
    expect(preview.recent[0].code).toMatch(/^CLI-/);
  });

  it("lista solo los servicios activos con su precio", async () => {
    const preview = await getNavPreview(ctx.db, AGENT_JOSUE, "services", TODAY);
    if (preview.section !== "services") throw new Error("sección equivocada");
    expect(preview.active).toBe(preview.items.length);
    expect(preview.items.every((service) => service.priceCents >= 0)).toBe(true);
  });

  it("resume lo agendado en el mes hasta hoy", async () => {
    const today = todayIn();
    const preview = await getNavPreview(ctx.db, AGENT_JOSUE, "reports", today);
    if (preview.section !== "reports") throw new Error("sección equivocada");
    expect(preview.from).toBe(`${today.slice(0, 8)}01`);
    expect(preview.to).toBe(today);
    expect(preview.cancelled).toBe(1);
    expect(preview.top[0]?.name).toBe(AGENT_JOSUE.name);
  });
});
