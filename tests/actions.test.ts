import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { runAction } from "@/server/actions";
import { createAppointment, getAppointment } from "@/server/appointments";
import { toErrorResponse } from "@/server/http";
import { DomainError } from "@/domain/appointment-rules";
import { AGENT_JOSUE } from "@/db/seed-data";
import { appointmentInput, createTestDb } from "./helpers";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.client.close();
});

describe("despachador de acciones", () => {
  it("ejecuta una acción válida", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx));
    const result = await runAction(ctx.db, AGENT_JOSUE, appointment.id, { action: "confirm" });
    expect(result.appointment.status).toBe("confirmed");
  });

  it("rechaza acciones desconocidas con ZodError", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-12-01" }));
    await expect(runAction(ctx.db, AGENT_JOSUE, appointment.id, { action: "delete" })).rejects.toBeInstanceOf(ZodError);
  });

  it("actualizar notas queda en el historial", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-12-02" }));
    await runAction(ctx.db, AGENT_JOSUE, appointment.id, { action: "update_notes", notes: "Portón azul" });
    const detail = await getAppointment(ctx.db, appointment.id);
    expect(detail.notes).toBe("Portón azul");
    expect(detail.history.some((h) => h.field === "notes")).toBe(true);
  });

  it("cita inexistente devuelve not_found", async () => {
    await expect(
      runAction(ctx.db, AGENT_JOSUE, "22222222-2222-4222-8222-222222222222", { action: "confirm" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("mapeo de errores HTTP", () => {
  it("ZodError -> 422", async () => {
    const res = toErrorResponse(new ZodError([]));
    expect(res.status).toBe(422);
  });

  it("DomainError conocido -> código HTTP correspondiente", () => {
    expect(toErrorResponse(new DomainError("unauthorized", "x")).status).toBe(401);
    expect(toErrorResponse(new DomainError("forbidden", "x")).status).toBe(403);
    expect(toErrorResponse(new DomainError("not_found", "x")).status).toBe(404);
  });

  it("DomainError de negocio -> 409", () => {
    expect(toErrorResponse(new DomainError("invalid_transition", "x")).status).toBe(409);
  });

  it("error inesperado -> 500 sin filtrar detalles", async () => {
    const res = toErrorResponse(new Error("boom"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal_error" });
  });
});
