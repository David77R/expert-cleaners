import { describe, expect, it } from "vitest";
import { dropStartMinutes, isDraggable, isSameSlot, laneAt, snapMinutes } from "@/domain/drag-target";

const grid = { startHour: 7, endHour: 20, hourPx: 88 };

describe("ajuste a intervalos", () => {
  it("redondea al cuarto de hora más cercano", () => {
    expect(snapMinutes(540)).toBe(540);
    expect(snapMinutes(547)).toBe(540);
    expect(snapMinutes(548)).toBe(555);
    expect(snapMinutes(562)).toBe(555);
  });
});

describe("hora de destino al soltar", () => {
  it("convierte la posición vertical en minutos", () => {
    const start = dropStartMinutes({ pointerOffsetPx: 88, grabOffsetMin: 0, durationMin: 60, ...grid });
    expect(start).toBe(8 * 60);
  });

  it("descuenta el punto donde se agarró la cita", () => {
    const start = dropStartMinutes({ pointerOffsetPx: 88 * 3, grabOffsetMin: 30, durationMin: 60, ...grid });
    expect(start).toBe(10 * 60 - 30);
  });

  it("ajusta a 15 minutos", () => {
    const start = dropStartMinutes({ pointerOffsetPx: 88 + 30, grabOffsetMin: 0, durationMin: 60, ...grid });
    expect(start % 15).toBe(0);
    expect(start).toBe(8 * 60 + 15);
  });

  it("no deja la cita antes de abrir", () => {
    expect(dropStartMinutes({ pointerOffsetPx: -200, grabOffsetMin: 0, durationMin: 60, ...grid })).toBe(7 * 60);
  });

  it("no deja que la cita termine después del cierre", () => {
    expect(dropStartMinutes({ pointerOffsetPx: 5000, grabOffsetMin: 0, durationMin: 90, ...grid })).toBe(20 * 60 - 90);
  });

  it("aguanta citas más largas que la jornada", () => {
    expect(dropStartMinutes({ pointerOffsetPx: 400, grabOffsetMin: 0, durationMin: 900, ...grid })).toBe(7 * 60);
  });
});

describe("carril bajo el puntero", () => {
  const lanes = [
    { id: "a", left: 100, right: 300 },
    { id: "b", left: 300, right: 500 },
    { id: "c", left: 500, right: 700 },
  ];

  it("elige el carril que contiene el puntero", () => {
    expect(laneAt(150, lanes)).toBe("a");
    expect(laneAt(300, lanes)).toBe("b");
    expect(laneAt(699, lanes)).toBe("c");
  });

  it("usa el carril más cercano si el puntero queda fuera", () => {
    expect(laneAt(10, lanes)).toBe("a");
    expect(laneAt(900, lanes)).toBe("c");
  });

  it("no inventa carriles", () => {
    expect(laneAt(10, [])).toBeNull();
  });
});

describe("qué citas se pueden arrastrar", () => {
  it("excluye las canceladas y las completadas", () => {
    expect(isDraggable("not_confirmed")).toBe(true);
    expect(isDraggable("confirmed")).toBe(true);
    expect(isDraggable("rescheduled")).toBe(true);
    expect(isDraggable("completed")).toBe(false);
    expect(isDraggable("cancelled")).toBe(false);
  });

  it("detecta cuando no hubo cambio", () => {
    expect(isSameSlot({ startMin: 540, technicianId: "a" }, { startMin: 540, technicianId: "a" })).toBe(true);
    expect(isSameSlot({ startMin: 540, technicianId: "a" }, { startMin: 555, technicianId: "a" })).toBe(false);
    expect(isSameSlot({ startMin: 540, technicianId: "a" }, { startMin: 540, technicianId: "b" })).toBe(false);
  });
});
