import { describe, expect, it } from "vitest";
import {
  assertTransition,
  blocksOverlap,
  canTransition,
  diffFields,
  DomainError,
  findConflicts,
  formatMinutes,
  resolveCancelReason,
  type TimeBlock,
} from "@/domain/appointment-rules";

const block = (over: Partial<TimeBlock>): TimeBlock => ({
  id: "a",
  technicianId: "t1",
  date: "2026-10-12",
  startMin: 540,
  durationMin: 60,
  status: "confirmed",
  ...over,
});

describe("transiciones de estado", () => {
  it("permite confirmar una cita no confirmada", () => {
    expect(canTransition("not_confirmed", "confirmed")).toBe(true);
  });

  it("no permite salir de cancelada ni de completada", () => {
    expect(canTransition("cancelled", "confirmed")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
  });

  it("lanza DomainError con código estable", () => {
    expect(() => assertTransition("cancelled", "confirmed")).toThrowError(DomainError);
    try {
      assertTransition("cancelled", "confirmed");
    } catch (e) {
      expect((e as DomainError).code).toBe("invalid_transition");
    }
  });
});

describe("conflictos de horario", () => {
  it("detecta solapamiento parcial", () => {
    expect(blocksOverlap({ startMin: 540, durationMin: 60 }, { startMin: 570, durationMin: 60 })).toBe(true);
  });

  it("citas pegadas no se solapan", () => {
    expect(blocksOverlap({ startMin: 540, durationMin: 60 }, { startMin: 600, durationMin: 30 })).toBe(false);
  });

  it("ignora canceladas, otros técnicos, otras fechas y a sí misma", () => {
    const candidate = block({ id: "x" });
    const others = [
      block({ id: "c", status: "cancelled" }),
      block({ id: "d", technicianId: "t2" }),
      block({ id: "e", date: "2026-10-13" }),
      block({ id: "x" }),
      block({ id: "ok", startMin: 570 }),
    ];
    expect(findConflicts(candidate, others).map((b) => b.id)).toEqual(["ok"]);
  });
});

describe("motivo de cancelación", () => {
  it("'other' exige explicación", () => {
    expect(() => resolveCancelReason("other", "  ")).toThrowError(DomainError);
    expect(resolveCancelReason("other", "Se mudó")).toBe("other: Se mudó");
  });

  it("los motivos estándar no piden explicación", () => {
    expect(resolveCancelReason("weather")).toBe("weather");
  });
});

describe("utilidades", () => {
  it("diffFields solo reporta lo que cambió", () => {
    const changes = diffFields({ a: 1, b: "x" }, { a: 2, b: "x" }, { a: "A", b: "B" });
    expect(changes).toEqual([{ field: "A", from: "1", to: "2" }]);
  });

  it("formatMinutes usa formato 12 horas", () => {
    expect(formatMinutes(0)).toBe("12:00 AM");
    expect(formatMinutes(780)).toBe("1:00 PM");
    expect(formatMinutes(570)).toBe("9:30 AM");
  });
});
