import { describe, expect, it } from "vitest";
import { describeChange, minutesToTimeInput, panelActions, parseTimeInput } from "@/domain/appointment-panel";

describe("acciones disponibles según el estado", () => {
  it("una cita nueva se puede confirmar, completar, reprogramar y cancelar", () => {
    expect(panelActions("not_confirmed", "unpaid", "not_generated")).toEqual({
      confirm: true,
      unconfirm: false,
      complete: true,
      pay: true,
      invoice: "generate",
      reschedule: true,
      cancel: true,
    });
  });

  it("una cita confirmada ya no ofrece confirmar", () => {
    const actions = panelActions("confirmed", "unpaid", "not_generated");
    expect(actions.confirm).toBe(false);
    expect(actions.unconfirm).toBe(true);
    expect(actions.complete).toBe(true);
  });

  it("una reprogramada se puede volver a confirmar", () => {
    expect(panelActions("rescheduled", "unpaid", "not_generated").confirm).toBe(true);
  });

  it("una completada solo permite cobrar y facturar", () => {
    expect(panelActions("completed", "unpaid", "generated")).toEqual({
      confirm: false,
      unconfirm: false,
      complete: false,
      pay: true,
      invoice: "send",
      reschedule: false,
      cancel: false,
    });
  });

  it("una cancelada no permite nada", () => {
    expect(panelActions("cancelled", "unpaid", "not_generated")).toEqual({
      confirm: false,
      unconfirm: false,
      complete: false,
      pay: false,
      invoice: null,
      reschedule: false,
      cancel: false,
    });
  });

  it("no ofrece cobrar si ya está pagada ni facturar si ya fue enviada", () => {
    const actions = panelActions("completed", "paid", "sent");
    expect(actions.pay).toBe(false);
    expect(actions.invoice).toBeNull();
  });
});

describe("horas de los formularios", () => {
  it("convierte HH:MM a minutos y rechaza lo inválido", () => {
    expect(parseTimeInput("09:30")).toBe(570);
    expect(parseTimeInput("9:05")).toBe(545);
    expect(parseTimeInput("23:59")).toBe(1439);
    expect(parseTimeInput("00:00")).toBe(0);
    expect(parseTimeInput("24:00")).toBeNull();
    expect(parseTimeInput("10:75")).toBeNull();
    expect(parseTimeInput("")).toBeNull();
    expect(parseTimeInput(null)).toBeNull();
    expect(parseTimeInput("tarde")).toBeNull();
  });

  it("convierte minutos al formato de un campo de hora", () => {
    expect(minutesToTimeInput(570)).toBe("09:30");
    expect(minutesToTimeInput(0)).toBe("00:00");
    expect(minutesToTimeInput(1005)).toBe("16:45");
  });
});

describe("texto del historial", () => {
  const names = { t1: "Carlos Betancourt", t2: "Yolanda Hernández" };

  it("explica cada tipo de cambio en español", () => {
    const entry = (field: string, fromValue: string | null, toValue: string | null) =>
      describeChange({ field, fromValue, toValue }, names);

    expect(entry("created", null, "not_confirmed")).toBe("Cita creada");
    expect(entry("status", "not_confirmed", "confirmed")).toBe("Estado: No confirmada → Confirmada");
    expect(entry("schedule", "2026-10-07 9:00 AM", "2026-10-09 10:00 AM")).toBe(
      "Horario: 2026-10-07 9:00 AM → 2026-10-09 10:00 AM",
    );
    expect(entry("start_time", "9:00 AM", "10:00 AM")).toBe("Hora: 9:00 AM → 10:00 AM");
    expect(entry("technician", "t1", "t2")).toBe("Técnico: Carlos Betancourt → Yolanda Hernández");
    expect(entry("technician", "x", null)).toBe("Técnico: técnico → sin técnico");
    expect(entry("payment", "unpaid", "paid")).toBe("Pago registrado");
    expect(entry("invoice", "not_generated", "generated")).toBe("Factura generada");
    expect(entry("invoice", "generated", "sent")).toBe("Factura enviada");
    expect(entry("notes", null, "Portón azul")).toBe("Notas actualizadas");
    expect(entry("notes", "Portón azul", null)).toBe("Notas eliminadas");
    expect(entry("cancellation_reason", null, "weather")).toBe("Motivo de cancelación: Clima");
    expect(entry("cancellation_reason", null, "other: No contesta")).toBe(
      "Motivo de cancelación: Otro motivo: No contesta",
    );
    expect(entry("reschedule_reason", null, "Pidió otro día")).toBe("Motivo de reprogramación: Pidió otro día");
    expect(entry("destination_address", null, "{}")).toBe("Dirección de entrega actualizada");
    expect(entry("billing_address", null, "{}")).toBe("Dirección de facturación actualizada");
    expect(entry("photo", null, "added")).toBe("Foto agregada");
    expect(entry("photo", null, "removed")).toBe("Foto eliminada");
    expect(entry("algo_nuevo", null, null)).toBe("algo_nuevo");
  });
});
