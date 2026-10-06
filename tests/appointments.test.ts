import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  advanceInvoice,
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  createAppointment,
  getAppointment,
  getDay,
  markPaid,
  moveAppointment,
  rescheduleAppointment,
  setDestinationAddress,
} from "@/server/appointments";
import { AGENT_JOSUE } from "@/db/seed-data";
import { DomainError } from "@/domain/appointment-rules";
import { appointmentInput, createTestDb } from "./helpers";

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.client.close();
});

const destination = { line1: "1200 Brickell Ave", unit: "Unit 3", city: "Miami", state: "FL", zip: "33131" };

describe("crear cita", () => {
  it("nace como no confirmada, no pagada, con código SVC y entrada de historial", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx));
    expect(appointment.status).toBe("not_confirmed");
    expect(appointment.paymentStatus).toBe("unpaid");
    expect(appointment.code).toMatch(/^SVC-\d+$/);
    expect(appointment.priceCents).toBe(ctx.services.sofa.basePriceCents);
    const detail = await getAppointment(ctx.db, appointment.id);
    expect(detail.history).toHaveLength(1);
    expect(detail.history[0].field).toBe("created");
  });

  it("genera códigos consecutivos", async () => {
    const a = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-10-20" }));
    const b = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-10-21" }));
    expect(Number(b.appointment.code.slice(4))).toBe(Number(a.appointment.code.slice(4)) + 1);
  });

  it("exige las especificaciones obligatorias del servicio", async () => {
    await expect(createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { specs: {} }))).rejects.toMatchObject({
      code: "specs_required",
    });
  });

  it("recogida y entrega exigen dirección de entrega", async () => {
    const base = appointmentInput(ctx, { serviceId: ctx.services["rug-pickup"].id, specs: {} });
    await expect(createAppointment(ctx.db, AGENT_JOSUE, base)).rejects.toMatchObject({ code: "destination_required" });
    const ok = await createAppointment(ctx.db, AGENT_JOSUE, { ...base, destinationAddress: destination });
    expect(ok.appointment.destinationAddress?.line1).toBe("1200 Brickell Ave");
  });

  it("un servicio normal rechaza dirección de entrega", async () => {
    await expect(
      createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { destinationAddress: destination })),
    ).rejects.toMatchObject({ code: "destination_not_allowed" });
  });

  it("rechaza una dirección que no es del cliente", async () => {
    await expect(
      createAppointment(
        ctx.db,
        AGENT_JOSUE,
        appointmentInput(ctx, { addressId: "11111111-1111-4111-8111-111111111111" }),
      ),
    ).rejects.toMatchObject({ code: "address_mismatch" });
  });

  it("advierte conflicto con el mismo técnico pero no bloquea", async () => {
    const date = "2026-11-02";
    await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date }));
    const second = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date, startMin: 570 }));
    expect(second.conflicts).toHaveLength(1);
    const day = await getDay(ctx.db, date);
    expect(day.overlapIds).toHaveLength(2);
  });
});

describe("flujo de estados", () => {
  it("confirmar y completar registran quién y qué cambió", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-10" }));
    await confirmAppointment(ctx.db, AGENT_JOSUE, appointment.id);
    const done = await completeAppointment(ctx.db, AGENT_JOSUE, appointment.id);
    expect(done.appointment.status).toBe("completed");
    const detail = await getAppointment(ctx.db, appointment.id);
    const statusChanges = detail.history.filter((h) => h.field === "status");
    expect(statusChanges.map((h) => h.toValue).sort()).toEqual(["completed", "confirmed"]);
    expect(statusChanges[0].actorName).toBe("Josué Perfecto");
  });

  it("una cita completada no se puede cancelar", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-11" }));
    await completeAppointment(ctx.db, AGENT_JOSUE, appointment.id);
    await expect(cancelAppointment(ctx.db, AGENT_JOSUE, appointment.id, { reason: "weather" })).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it("cancelar conserva la cita y guarda el motivo", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-12" }));
    const { appointment: cancelled } = await cancelAppointment(ctx.db, AGENT_JOSUE, appointment.id, {
      reason: "other",
      explanation: "Se mudó",
    });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancellationReason).toBe("other: Se mudó");
    const day = await getDay(ctx.db, "2026-11-12");
    expect(day.appointments.map((a) => a.id)).toContain(appointment.id);
  });

  it("cancelar con 'other' sin explicación falla", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-13" }));
    await expect(cancelAppointment(ctx.db, AGENT_JOSUE, appointment.id, { reason: "other" })).rejects.toMatchObject({
      code: "explanation_required",
    });
  });

  it("las canceladas no generan conflicto", async () => {
    const date = "2026-11-14";
    const first = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date }));
    await cancelAppointment(ctx.db, AGENT_JOSUE, first.appointment.id, { reason: "weather" });
    const second = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date }));
    expect(second.conflicts).toHaveLength(0);
  });
});

describe("reprogramar y mover", () => {
  it("reprogramar exige motivo y cambia fecha, hora y técnico", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-16" }));
    await expect(
      rescheduleAppointment(ctx.db, AGENT_JOSUE, appointment.id, { date: "2026-11-17", startMin: 600, reason: " " }),
    ).rejects.toThrow();
    const { appointment: moved } = await rescheduleAppointment(ctx.db, AGENT_JOSUE, appointment.id, {
      date: "2026-11-17",
      startMin: 600,
      technicianId: ctx.techs[1].id,
      reason: "Cliente pidió otro día",
    });
    expect(moved.status).toBe("rescheduled");
    expect(moved.date).toBe("2026-11-17");
    expect(moved.technicianId).toBe(ctx.techs[1].id);
    const detail = await getAppointment(ctx.db, appointment.id);
    expect(detail.history.map((h) => h.field)).toEqual(
      expect.arrayContaining(["schedule", "technician", "status", "reschedule_reason"]),
    );
  });

  it("mover (drag & drop) devuelve advertencia de conflicto y la guarda igual", async () => {
    const date = "2026-11-18";
    await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date, startMin: 540 }));
    const other = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date, startMin: 720 }));
    const result = await moveAppointment(ctx.db, AGENT_JOSUE, other.appointment.id, {
      startMin: 560,
      technicianId: ctx.techs[0].id,
    });
    expect(result.appointment.startMin).toBe(560);
    expect(result.conflicts).toHaveLength(1);
  });
});

describe("pago, factura y direcciones", () => {
  it("pago e invoice son independientes del estado de la cita", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-20" }));
    const paid = await markPaid(ctx.db, AGENT_JOSUE, appointment.id);
    expect(paid.appointment.paymentStatus).toBe("paid");
    expect(paid.appointment.status).toBe("not_confirmed");
    const generated = await advanceInvoice(ctx.db, AGENT_JOSUE, appointment.id);
    expect(generated.appointment.invoiceStatus).toBe("generated");
    const sent = await advanceInvoice(ctx.db, AGENT_JOSUE, appointment.id);
    expect(sent.appointment.invoiceStatus).toBe("sent");
    await expect(advanceInvoice(ctx.db, AGENT_JOSUE, appointment.id)).rejects.toMatchObject({ code: "invoice_sent" });
  });

  it("marcar pagada dos veces no duplica historial", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-21" }));
    await markPaid(ctx.db, AGENT_JOSUE, appointment.id);
    await markPaid(ctx.db, AGENT_JOSUE, appointment.id);
    const detail = await getAppointment(ctx.db, appointment.id);
    expect(detail.history.filter((h) => h.field === "payment")).toHaveLength(1);
  });

  it("cambiar la dirección de entrega solo aplica a servicios de dos direcciones", async () => {
    const normal = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-22" }));
    await expect(setDestinationAddress(ctx.db, AGENT_JOSUE, normal.appointment.id, destination)).rejects.toMatchObject({
      code: "destination_not_allowed",
    });
    const pickup = await createAppointment(ctx.db, AGENT_JOSUE, {
      ...appointmentInput(ctx, { date: "2026-11-22", serviceId: ctx.services["rug-pickup"].id, specs: {} }),
      destinationAddress: destination,
    });
    const changed = await setDestinationAddress(ctx.db, AGENT_JOSUE, pickup.appointment.id, {
      ...destination,
      line1: "5500 NW 36th St",
    });
    expect(changed.appointment.destinationAddress?.line1).toBe("5500 NW 36th St");
  });
});
