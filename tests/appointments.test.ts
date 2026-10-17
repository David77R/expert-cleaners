import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  advanceInvoice,
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  unconfirmAppointment,
  createAppointment,
  getAppointment,
  getDay,
  markPaid,
  moveAppointment,
  rescheduleAppointment,
  setAppointmentAddress,
  setDestinationAddress,
  updateAppointmentItems,
  setStage,
  setReadyDate,
  scheduleDelivery,
  clearDelivery,
  getDeliveries,
  conflictingAppointments,
} from "@/server/appointments";
import { asDeliveryEntry, appointmentIdFromKey, currentStage, deliveryKey } from "@/domain/delivery";
import { describeChange } from "@/domain/appointment-panel";
import { addresses } from "@/db/schema";
import { AGENT_JOSUE } from "@/db/seed-data";
import { DomainError } from "@/domain/appointment-rules";
import { appointmentInput, createTestDb } from "./helpers";

vi.mock("@/server/geocoding", () => ({
  geocodeIfNeeded: async (address: unknown) => address,
  getGeocoder: () => null,
}));

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

  it("se puede quitar la confirmación y queda en el historial", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-12" }));
    await confirmAppointment(ctx.db, AGENT_JOSUE, appointment.id);
    const undone = await unconfirmAppointment(ctx.db, AGENT_JOSUE, appointment.id);
    expect(undone.appointment.status).toBe("not_confirmed");
    const detail = await getAppointment(ctx.db, appointment.id);
    expect(detail.history.filter((h) => h.field === "status").map((h) => h.toValue)).toContain("not_confirmed");
    await expect(unconfirmAppointment(ctx.db, AGENT_JOSUE, appointment.id)).rejects.toBeInstanceOf(DomainError);
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

  it("lista con qué citas choca una cita para mostrarlo en el panel", async () => {
    const date = "2026-11-21";
    const first = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date }));
    const second = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date, startMin: 570 }));
    const partners = await conflictingAppointments(ctx.db, first.appointment.id);
    expect(partners).toEqual([
      {
        id: second.appointment.id,
        code: second.appointment.code,
        startMin: 570,
        durationMin: second.appointment.durationMin,
      },
    ]);
    await cancelAppointment(ctx.db, AGENT_JOSUE, second.appointment.id, { reason: "weather" });
    expect(await conflictingAppointments(ctx.db, first.appointment.id)).toEqual([]);
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

  it("reprogramar puede cambiar la hora de salida", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-19" }));
    const { appointment: moved } = await rescheduleAppointment(ctx.db, AGENT_JOSUE, appointment.id, {
      date: "2026-11-19",
      startMin: 540,
      durationMin: 150,
      reason: "Termina más tarde",
    });
    expect(moved.durationMin).toBe(150);
    const detail = await getAppointment(ctx.db, appointment.id);
    expect(detail.history.map((h) => h.field)).toContain("duration");
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

  it("una cita completada se puede pasar a otro técnico sin perder el estado", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-23" }));
    await completeAppointment(ctx.db, AGENT_JOSUE, appointment.id);
    const { appointment: moved } = await moveAppointment(ctx.db, AGENT_JOSUE, appointment.id, {
      startMin: 600,
      technicianId: ctx.techs[1].id,
    });
    expect(moved.status).toBe("completed");
    expect(moved.technicianId).toBe(ctx.techs[1].id);
    expect(moved.startMin).toBe(600);
  });

  it("una cita cancelada no se mueve", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-24" }));
    await cancelAppointment(ctx.db, AGENT_JOSUE, appointment.id, { reason: "weather" });
    await expect(
      moveAppointment(ctx.db, AGENT_JOSUE, appointment.id, { startMin: 600, technicianId: ctx.techs[0].id }),
    ).rejects.toMatchObject({ code: "not_movable" });
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

  it("las alfombras pueden llevar otra dirección de entrega y volver a la misma", async () => {
    const rugSpecs = { length: 8, width: 10, carpetType: "Lana", quantity: 1 };
    const rug = await createAppointment(ctx.db, AGENT_JOSUE, {
      ...appointmentInput(ctx, { date: "2026-11-23", serviceId: ctx.services.carpet.id, specs: rugSpecs }),
      destinationAddress: destination,
    });
    expect(rug.appointment.destinationAddress?.line1).toBe("1200 Brickell Ave");
    const same = await setDestinationAddress(ctx.db, AGENT_JOSUE, rug.appointment.id, null);
    expect(same.appointment.destinationAddress).toBeNull();
    const plain = await createAppointment(
      ctx.db,
      AGENT_JOSUE,
      appointmentInput(ctx, { date: "2026-11-23", serviceId: ctx.services.carpet.id, specs: rugSpecs }),
    );
    expect(plain.appointment.destinationAddress).toBeNull();
  });

  it("un servicio de dos direcciones no puede quedarse sin dirección de entrega", async () => {
    const pickup = await createAppointment(ctx.db, AGENT_JOSUE, {
      ...appointmentInput(ctx, { date: "2026-11-24", serviceId: ctx.services["rug-pickup"].id, specs: {} }),
      destinationAddress: destination,
    });
    await expect(setDestinationAddress(ctx.db, AGENT_JOSUE, pickup.appointment.id, null)).rejects.toMatchObject({
      code: "destination_required",
    });
  });

  it("cambia la dirección del servicio a otra del mismo cliente y lo deja en el historial", async () => {
    const [second] = await ctx.db
      .insert(addresses)
      .values({ customerId: ctx.customer.id, line1: "900 Biscayne Blvd", city: "Miami", state: "FL", zip: "33132" })
      .returning();
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-23" }));
    const changed = await setAppointmentAddress(ctx.db, AGENT_JOSUE, appointment.id, { addressId: second.id });
    expect(changed.appointment.addressId).toBe(second.id);
    const detail = await getAppointment(ctx.db, appointment.id);
    expect(detail.address.line1).toBe("900 Biscayne Blvd");
    expect(detail.customer.addresses.map((a) => a.id)).toContain(second.id);
    const entry = detail.history.find((h) => h.field === "address");
    expect(entry?.toValue).toBe("900 Biscayne Blvd, Miami, FL 33132");

    const back = await setAppointmentAddress(ctx.db, AGENT_JOSUE, appointment.id, { addressId: ctx.address.id });
    expect(back.appointment.addressId).toBe(ctx.address.id);
  });

  it("no acepta direcciones de otro cliente ni cambios en citas canceladas", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-24" }));
    await expect(
      setAppointmentAddress(ctx.db, AGENT_JOSUE, appointment.id, { addressId: "11111111-1111-4111-8111-111111111111" }),
    ).rejects.toMatchObject({ code: "address_mismatch" });
    await cancelAppointment(ctx.db, AGENT_JOSUE, appointment.id, { reason: "weather" });
    await expect(
      setAppointmentAddress(ctx.db, AGENT_JOSUE, appointment.id, { addressId: ctx.address.id }),
    ).rejects.toMatchObject({ code: "cancelled" });
  });
});

describe("varios servicios por cita", () => {
  const carpetSpecs = { length: 12, width: 10, carpetType: "Lana", quantity: 1 };

  it("crea la cita con varios servicios y suma el total", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, {
      ...appointmentInput(ctx, { date: "2026-11-25" }),
      serviceId: undefined,
      items: [
        { serviceId: ctx.services.sofa.id, specs: { sofaType: "Tela", seats: 3, sofaLength: 84 }, priceCents: 15000 },
        { serviceId: ctx.services.carpet.id, specs: carpetSpecs },
      ],
    });
    expect(appointment.priceCents).toBe(15000 + ctx.services.carpet.basePriceCents);
    expect(appointment.serviceId).toBe(ctx.services.sofa.id);
    const detail = await getAppointment(ctx.db, appointment.id);
    expect(detail.items.map((item) => item.service.name)).toEqual([ctx.services.sofa.name, ctx.services.carpet.name]);
    expect(detail.items[0].specs).toMatchObject({ sofaLength: 84 });
  });

  it("pide las especificaciones obligatorias de cada servicio", async () => {
    await expect(
      createAppointment(ctx.db, AGENT_JOSUE, {
        ...appointmentInput(ctx, { date: "2026-11-25" }),
        items: [
          { serviceId: ctx.services.sofa.id, specs: { sofaType: "Tela", seats: 2 } },
          { serviceId: ctx.services.carpet.id, specs: {} },
        ],
      }),
    ).rejects.toMatchObject({ code: "specs_required" });
  });

  it("edita servicios, precio y duración desde la cita y lo deja en el historial", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-26" }));
    const changed = await updateAppointmentItems(ctx.db, AGENT_JOSUE, appointment.id, {
      items: [
        { serviceId: ctx.services.sofa.id, specs: { sofaType: "Tela", seats: 3 }, priceCents: 9900 },
        { serviceId: ctx.services.carpet.id, specs: carpetSpecs, priceCents: 5000 },
      ],
      durationMin: 120,
    });
    expect(changed.appointment.priceCents).toBe(14900);
    expect(changed.appointment.durationMin).toBe(120);
    const detail = await getAppointment(ctx.db, appointment.id);
    expect(detail.items).toHaveLength(2);
    const fields = detail.history.map((entry) => entry.field);
    expect(fields).toEqual(expect.arrayContaining(["items", "price", "duration"]));
    expect(detail.history.find((entry) => entry.field === "price")?.toValue).toBe("$149.00");

    const again = await updateAppointmentItems(ctx.db, AGENT_JOSUE, appointment.id, {
      items: [
        { serviceId: ctx.services.sofa.id, specs: { seats: 3, sofaType: "Tela" }, priceCents: 9900 },
        { serviceId: ctx.services.carpet.id, specs: carpetSpecs, priceCents: 5000 },
      ],
      durationMin: 120,
    });
    expect(again.appointment.updatedAt).toEqual(changed.appointment.updatedAt);
  });

  it("no deja cambiar servicios con la factura enviada ni en citas canceladas", async () => {
    const items = [{ serviceId: ctx.services.sofa.id, specs: { sofaType: "Tela", seats: 1 } }];
    const sent = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-27" }));
    await advanceInvoice(ctx.db, AGENT_JOSUE, sent.appointment.id);
    await advanceInvoice(ctx.db, AGENT_JOSUE, sent.appointment.id);
    await expect(updateAppointmentItems(ctx.db, AGENT_JOSUE, sent.appointment.id, { items })).rejects.toMatchObject({
      code: "invoice_sent",
    });
    const cancelled = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-27" }));
    await cancelAppointment(ctx.db, AGENT_JOSUE, cancelled.appointment.id, { reason: "weather" });
    await expect(
      updateAppointmentItems(ctx.db, AGENT_JOSUE, cancelled.appointment.id, { items }),
    ).rejects.toMatchObject({ code: "cancelled" });
  });

  it("al agregar recogida pide la dirección de entrega y al quitarla la borra", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-28" }));
    const sofaItem = { serviceId: ctx.services.sofa.id, specs: { sofaType: "Tela", seats: 2 } };
    const pickupItem = { serviceId: ctx.services["rug-pickup"].id, specs: {} };
    await expect(
      updateAppointmentItems(ctx.db, AGENT_JOSUE, appointment.id, { items: [sofaItem, pickupItem] }),
    ).rejects.toMatchObject({ code: "destination_required" });
    const withPickup = await updateAppointmentItems(ctx.db, AGENT_JOSUE, appointment.id, {
      items: [sofaItem, pickupItem],
      destinationAddress: destination,
    });
    expect(withPickup.appointment.destinationAddress?.line1).toBe(destination.line1);
    const changed = await setDestinationAddress(ctx.db, AGENT_JOSUE, appointment.id, { ...destination, unit: "" });
    expect(changed.appointment.destinationAddress?.unit).toBe("");
    const back = await updateAppointmentItems(ctx.db, AGENT_JOSUE, appointment.id, { items: [sofaItem] });
    expect(back.appointment.destinationAddress).toBeNull();
  });
});

describe("etapas, listo en y entregas", () => {
  it("marca y desmarca etapas con quién y cuándo", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-12-01" }));
    const picked = await setStage(ctx.db, AGENT_JOSUE, appointment.id, { stage: "pickedUp", done: true });
    expect(picked.appointment.stages.pickedUp?.by).toBe(AGENT_JOSUE.name);
    const again = await setStage(ctx.db, AGENT_JOSUE, appointment.id, { stage: "pickedUp", done: true });
    expect(again.appointment.stages.pickedUp?.at).toBe(picked.appointment.stages.pickedUp?.at);
    const cleaned = await setStage(ctx.db, AGENT_JOSUE, appointment.id, { stage: "cleaned", done: true });
    expect(currentStage(cleaned.appointment.stages)).toBe("cleaned");
    const undone = await setStage(ctx.db, AGENT_JOSUE, appointment.id, { stage: "cleaned", done: false });
    expect(undone.appointment.stages.cleaned).toBeUndefined();

    const detail = await getAppointment(ctx.db, appointment.id);
    const stageEntries = detail.history.filter((h) => h.field === "stage");
    expect(stageEntries).toHaveLength(3);
    expect(describeChange(stageEntries[0])).toBe("Limpiado: desmarcado");
    await expect(setStage(ctx.db, AGENT_JOSUE, appointment.id, { stage: "otra", done: true })).rejects.toBeInstanceOf(
      Error,
    );
  });

  it("guarda y quita la fecha de listo", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-12-02" }));
    const set = await setReadyDate(ctx.db, AGENT_JOSUE, appointment.id, { readyDate: "2026-12-04" });
    expect(set.appointment.readyDate).toBe("2026-12-04");
    const cleared = await setReadyDate(ctx.db, AGENT_JOSUE, appointment.id, { readyDate: null });
    expect(cleared.appointment.readyDate).toBeNull();
  });

  it("programa la entrega otro día y aparece en las entregas de ese día", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-12-03" }));
    await expect(
      scheduleDelivery(ctx.db, AGENT_JOSUE, appointment.id, {
        date: "2026-12-02",
        startMin: 600,
        durationMin: 60,
        technicianId: ctx.techs[1].id,
      }),
    ).rejects.toMatchObject({ code: "delivery_before_service" });

    const scheduled = await scheduleDelivery(ctx.db, AGENT_JOSUE, appointment.id, {
      date: "2026-12-05",
      startMin: 600,
      durationMin: 45,
      technicianId: ctx.techs[1].id,
    });
    expect(scheduled.appointment.deliveryDate).toBe("2026-12-05");

    const deliveries = await getDeliveries(ctx.db, "2026-12-05", "2026-12-05");
    expect(deliveries.map((d) => d.id)).toContain(appointment.id);
    const entry = asDeliveryEntry(deliveries.find((d) => d.id === appointment.id)!);
    expect(entry).toMatchObject({ kind: "delivery", date: "2026-12-05", startMin: 600, durationMin: 45 });
    expect(entry?.technician.id).toBe(ctx.techs[1].id);
    expect(await getDeliveries(ctx.db, "2026-12-05", "2026-12-05", ctx.techs[0].id)).toHaveLength(0);
    expect((await getDay(ctx.db, "2026-12-05")).appointments.map((a) => a.id)).not.toContain(appointment.id);

    await clearDelivery(ctx.db, AGENT_JOSUE, appointment.id);
    expect(await getDeliveries(ctx.db, "2026-12-05", "2026-12-05")).toHaveLength(0);
    const detail = await getAppointment(ctx.db, appointment.id);
    expect(detail.history.filter((h) => h.field === "delivery").map((h) => describeChange(h))).toEqual([
      "Entrega quitada",
      "Entrega: 2026-12-05 10:00 AM",
    ]);
  });

  it("avisa si la entrega choca con otra cita del técnico y oculta las canceladas", async () => {
    await createAppointment(
      ctx.db,
      AGENT_JOSUE,
      appointmentInput(ctx, { date: "2026-12-08", startMin: 540, technicianId: ctx.techs[2].id }),
    );
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-12-07" }));
    const scheduled = await scheduleDelivery(ctx.db, AGENT_JOSUE, appointment.id, {
      date: "2026-12-08",
      startMin: 570,
      durationMin: 60,
      technicianId: ctx.techs[2].id,
    });
    expect(scheduled.conflicts.length).toBeGreaterThan(0);
    await cancelAppointment(ctx.db, AGENT_JOSUE, appointment.id, { reason: "weather" });
    expect(await getDeliveries(ctx.db, "2026-12-08", "2026-12-08")).toHaveLength(0);
    await expect(
      setStage(ctx.db, AGENT_JOSUE, appointment.id, { stage: "pickedUp", done: true }),
    ).rejects.toMatchObject({ code: "cancelled" });
  });

  it("las claves de entrega se distinguen de la cita", () => {
    const key = deliveryKey("11111111-1111-4111-8111-111111111111");
    expect(key).toBe("11111111-1111-4111-8111-111111111111:entrega");
    expect(appointmentIdFromKey(key)).toBe("11111111-1111-4111-8111-111111111111");
  });
});

describe("crear el pedido con la entrega programada", () => {
  it("guarda recogida, entrega y fecha de listo en un solo paso", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, {
      ...appointmentInput(ctx, { date: "2026-12-10" }),
      readyDate: "2026-12-11",
      delivery: { date: "2026-12-12", startMin: 600, durationMin: 45, technicianId: ctx.techs[1].id },
    });
    expect(appointment).toMatchObject({
      readyDate: "2026-12-11",
      deliveryDate: "2026-12-12",
      deliveryStartMin: 600,
      deliveryDurationMin: 45,
      deliveryTechnicianId: ctx.techs[1].id,
    });
    expect((await getDeliveries(ctx.db, "2026-12-12", "2026-12-12")).map((d) => d.id)).toContain(appointment.id);
  });

  it("rechaza una entrega antes de la recogida", async () => {
    await expect(
      createAppointment(ctx.db, AGENT_JOSUE, {
        ...appointmentInput(ctx, { date: "2026-12-10" }),
        delivery: { date: "2026-12-09", startMin: 600, durationMin: 45, technicianId: ctx.techs[1].id },
      }),
    ).rejects.toMatchObject({ code: "delivery_before_service" });
  });
});

describe("detalles por artículo", () => {
  it("guarda color, tamaño, dimensiones y notas, y conserva el id del artículo al editar", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, {
      ...appointmentInput(ctx, { date: "2026-12-15" }),
      serviceId: undefined,
      items: [
        {
          serviceId: ctx.services.sofa.id,
          specs: { sofaType: "Tela", seats: 3 },
          details: { color: " Beige ", size: "Grande", dimensions: '84" x 36"', notes: "Mancha de café" },
        },
      ],
    });
    const before = await getAppointment(ctx.db, appointment.id);
    expect(before.items[0].details).toEqual({
      color: "Beige",
      size: "Grande",
      dimensions: '84" x 36"',
      notes: "Mancha de café",
    });

    await updateAppointmentItems(ctx.db, AGENT_JOSUE, appointment.id, {
      items: [
        {
          serviceId: ctx.services.sofa.id,
          specs: { sofaType: "Tela", seats: 3 },
          details: { color: "Gris" },
        },
        { serviceId: ctx.services.sofa.id, specs: { sofaType: "Cuero", seats: 1 } },
      ],
    });
    const after = await getAppointment(ctx.db, appointment.id);
    expect(after.items[0].id).toBe(before.items[0].id);
    expect(after.items[0].details).toEqual({ color: "Gris" });
    expect(after.items).toHaveLength(2);
    expect(after.history.some((entry) => entry.field === "items")).toBe(true);

    await updateAppointmentItems(ctx.db, AGENT_JOSUE, appointment.id, {
      items: [{ serviceId: ctx.services.sofa.id, specs: { sofaType: "Tela", seats: 3 }, details: { color: "Gris" } }],
    });
    const trimmed = await getAppointment(ctx.db, appointment.id);
    expect(trimmed.items.map((item) => item.id)).toEqual([before.items[0].id]);
  });

  it("rechaza detalles demasiado largos", async () => {
    await expect(
      createAppointment(ctx.db, AGENT_JOSUE, {
        ...appointmentInput(ctx, { date: "2026-12-15" }),
        items: [
          {
            serviceId: ctx.services.sofa.id,
            specs: { sofaType: "Tela", seats: 1 },
            details: { color: "x".repeat(41) },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(Error);
  });
});
