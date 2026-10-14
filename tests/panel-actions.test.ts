import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AGENT_JOSUE } from "@/db/seed-data";
import { createAppointment, getAppointment } from "@/server/appointments";
import { executeAction, payloadFromForm } from "@/server/panel-actions";
import { appointmentInput, createTestDb } from "./helpers";

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;
let counter = 0;

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.client.close();
});

async function appointment(overrides: Record<string, unknown> = {}) {
  counter += 1;
  const date = `2027-07-${String(counter).padStart(2, "0")}`;
  const { appointment: created } = await createAppointment(
    ctx.db,
    AGENT_JOSUE,
    appointmentInput(ctx, { date, ...overrides }),
  );
  return created;
}

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("datos de los formularios del panel", () => {
  it("arma el cuerpo de cada acción", () => {
    expect(payloadFromForm("confirm", form({}))).toEqual({ action: "confirm" });
    expect(payloadFromForm("cancel", form({ reason: "weather", explanation: "Tormenta" }))).toEqual({
      action: "cancel",
      reason: "weather",
      explanation: "Tormenta",
    });
    expect(
      payloadFromForm(
        "reschedule",
        form({ date: "2027-08-01", time: "10:30", technicianId: "", reason: "Pidió otro día" }),
      ),
    ).toEqual({
      action: "reschedule",
      date: "2027-08-01",
      startMin: 630,
      technicianId: undefined,
      reason: "Pidió otro día",
    });
    expect(payloadFromForm("update_notes", form({ notes: "  Portón azul  " }))).toEqual({
      action: "update_notes",
      notes: "Portón azul",
    });
  });

  it("deja la hora sin definir cuando no es válida", () => {
    const payload = payloadFromForm("reschedule", form({ date: "2027-08-01", time: "25:99", reason: "x" }));
    expect(payload.startMin).toBeUndefined();
  });
});

describe("ejecución de acciones del panel", () => {
  it("confirma y completa una cita", async () => {
    const created = await appointment();
    expect(await executeAction(ctx.db, AGENT_JOSUE, created.id, { action: "confirm" })).toEqual({ ok: true });
    expect((await getAppointment(ctx.db, created.id)).status).toBe("confirmed");
    expect(await executeAction(ctx.db, AGENT_JOSUE, created.id, { action: "complete" })).toEqual({ ok: true });
    expect((await getAppointment(ctx.db, created.id)).status).toBe("completed");
  });

  it("traduce una transición inválida a un mensaje claro", async () => {
    const created = await appointment();
    await executeAction(ctx.db, AGENT_JOSUE, created.id, { action: "complete" });
    const result = await executeAction(ctx.db, AGENT_JOSUE, created.id, { action: "confirm" });
    expect(result).toEqual({
      ok: false,
      error: "Esta acción ya no está disponible para el estado actual de la cita.",
    });
  });

  it("pide un motivo al cancelar y una explicación cuando es «otro»", async () => {
    const created = await appointment();
    const noReason = await executeAction(
      ctx.db,
      AGENT_JOSUE,
      created.id,
      payloadFromForm("cancel", form({ reason: "", explanation: "" })),
    );
    expect(noReason).toEqual({ ok: false, error: "Elige un motivo de cancelación" });

    const noExplanation = await executeAction(
      ctx.db,
      AGENT_JOSUE,
      created.id,
      payloadFromForm("cancel", form({ reason: "other", explanation: "" })),
    );
    expect(noExplanation).toEqual({ ok: false, error: "Explica el motivo de la cancelación" });

    const ok = await executeAction(
      ctx.db,
      AGENT_JOSUE,
      created.id,
      payloadFromForm("cancel", form({ reason: "weather", explanation: "" })),
    );
    expect(ok).toEqual({ ok: true });
    expect((await getAppointment(ctx.db, created.id)).status).toBe("cancelled");
  });

  it("reprograma con mensajes claros y avisa si queda solapada", async () => {
    const first = await appointment({ startMin: 540, durationMin: 60 });
    const second = await appointment({ startMin: 540, durationMin: 60 });

    const badTime = await executeAction(
      ctx.db,
      AGENT_JOSUE,
      second.id,
      payloadFromForm("reschedule", form({ date: first.date, time: "", reason: "Cambio" })),
    );
    expect(badTime).toEqual({ ok: false, error: "Elige una hora válida" });

    const badDate = await executeAction(
      ctx.db,
      AGENT_JOSUE,
      second.id,
      payloadFromForm("reschedule", form({ date: "2027-13-45", time: "09:00", reason: "Cambio" })),
    );
    expect(badDate).toEqual({ ok: false, error: "Elige una fecha válida" });

    const noReason = await executeAction(
      ctx.db,
      AGENT_JOSUE,
      second.id,
      payloadFromForm("reschedule", form({ date: first.date, time: "09:00", reason: " " })),
    );
    expect(noReason.ok).toBe(false);

    const overlapped = await executeAction(
      ctx.db,
      AGENT_JOSUE,
      second.id,
      payloadFromForm("reschedule", form({ date: first.date, time: "09:30", reason: "Pidió este día" })),
    );
    expect(overlapped).toEqual({
      ok: true,
      notice: "Reprogramada. Tiene conflicto con 1 cita: revisa el horario.",
    });
    const detail = await getAppointment(ctx.db, second.id);
    expect(detail.status).toBe("rescheduled");
    expect(detail.date).toBe(first.date);
    expect(detail.startMin).toBe(570);
  });

  it("registra el cobro, avanza la factura y guarda notas", async () => {
    const created = await appointment();
    expect(await executeAction(ctx.db, AGENT_JOSUE, created.id, { action: "mark_paid" })).toEqual({ ok: true });
    expect(await executeAction(ctx.db, AGENT_JOSUE, created.id, { action: "advance_invoice" })).toEqual({ ok: true });
    expect(
      await executeAction(ctx.db, AGENT_JOSUE, created.id, payloadFromForm("update_notes", form({ notes: " Perro " }))),
    ).toEqual({ ok: true });

    const detail = await getAppointment(ctx.db, created.id);
    expect(detail.paymentStatus).toBe("paid");
    expect(detail.invoiceStatus).toBe("generated");
    expect(detail.notes).toBe("Perro");
  });

  it("informa si la cita ya no existe o la acción es desconocida", async () => {
    const missing = await executeAction(ctx.db, AGENT_JOSUE, "00000000-0000-4000-8000-0000000000ff", {
      action: "confirm",
    });
    expect(missing).toEqual({ ok: false, error: "La cita no existe" });

    const unknown = await executeAction(ctx.db, AGENT_JOSUE, "00000000-0000-4000-8000-0000000000ff", {
      action: "borrar",
    });
    expect(unknown.ok).toBe(false);
  });
});

describe("mover una cita arrastrándola", () => {
  it("cambia la hora y el técnico y deja historial", async () => {
    const created = await appointment();
    const result = await executeAction(ctx.db, AGENT_JOSUE, created.id, {
      action: "move",
      startMin: 630,
      technicianId: ctx.techs[1].id,
    });
    expect(result).toEqual({ ok: true });
    const detail = await getAppointment(ctx.db, created.id);
    expect(detail.startMin).toBe(630);
    expect(detail.technicianId).toBe(ctx.techs[1].id);
    expect(detail.history.some((entry) => entry.field === "start_time")).toBe(true);
    expect(detail.history.some((entry) => entry.field === "technician")).toBe(true);
  });

  it("avisa del solape pero mueve igual", async () => {
    const first = await appointment({ startMin: 540 });
    const second = await appointment({ date: first.date, startMin: 720 });
    const result = await executeAction(ctx.db, AGENT_JOSUE, second.id, {
      action: "move",
      startMin: 555,
      technicianId: first.technicianId,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.notice).toMatch(/^Movida\. Tiene conflicto con 1 cita/);
    expect((await getAppointment(ctx.db, second.id)).startMin).toBe(555);
  });

  it("rechaza una hora fuera de rango con un mensaje claro", async () => {
    const created = await appointment();
    const result = await executeAction(ctx.db, AGENT_JOSUE, created.id, {
      action: "move",
      startMin: 5000,
      technicianId: created.technicianId,
    });
    expect(result).toEqual({ ok: false, error: "Elige una hora válida" });
  });

  it("no mueve citas canceladas ni completadas", async () => {
    const cancelled = await appointment();
    await executeAction(ctx.db, AGENT_JOSUE, cancelled.id, { action: "cancel", reason: "weather", explanation: "" });
    const result = await executeAction(ctx.db, AGENT_JOSUE, cancelled.id, {
      action: "move",
      startMin: 600,
      technicianId: cancelled.technicianId,
    });
    expect(result).toEqual({ ok: false, error: "Esta cita ya no se puede mover" });
  });
});
