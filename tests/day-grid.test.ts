import { describe, expect, it } from "vitest";
import { gridHours, toPx } from "@/lib/day-grid";

describe("rango de horas del calendario del día", () => {
  it("usa 7 AM a 8 PM cuando todo cae dentro", () => {
    expect(gridHours([{ startMin: 9 * 60, durationMin: 120 }])).toEqual({ startHour: 7, endHour: 20 });
  });

  it("se amplía para mostrar citas de madrugada o de noche", () => {
    expect(gridHours([{ startMin: 60, durationMin: 60 }])).toEqual({ startHour: 1, endHour: 20 });
    expect(gridHours([{ startMin: 21 * 60 + 30, durationMin: 90 }])).toEqual({ startHour: 7, endHour: 23 });
    expect(gridHours([{ startMin: 23 * 60, durationMin: 120 }]).endHour).toBe(24);
  });

  it("calcula la posición desde la hora de inicio del rango", () => {
    expect(toPx(8 * 60)).toBe(88);
    expect(toPx(60, 1)).toBe(0);
  });
});
