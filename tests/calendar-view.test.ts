import { describe, expect, it } from "vitest";
import { avatarTone, AVATAR_TONES, formatPhone } from "@/domain/customer-rules";
import {
  formatDayLabel,
  formatRange,
  offShiftRanges,
  readableOn,
  viewHeading,
  initialsOf,
  isInSameMonth,
  layoutSlots,
  monthWeeks,
  parseView,
  shiftAnchor,
  summarize,
  viewRange,
  viewTitle,
  weekDates,
} from "@/domain/calendar-view";
import { daysBetween, minutesNowIn } from "@/domain/date-rules";
import { rangeQuerySchema } from "@/domain/schemas";

describe("selección de vista", () => {
  it("usa día cuando el valor no es válido", () => {
    expect(parseView("week")).toBe("week");
    expect(parseView("month")).toBe("month");
    expect(parseView("day")).toBe("day");
    expect(parseView("year")).toBe("day");
    expect(parseView(undefined)).toBe("day");
    expect(parseView(["week"])).toBe("day");
  });
});

describe("rangos por vista", () => {
  it("día y semana (domingo a sábado)", () => {
    expect(viewRange("day", "2026-10-07")).toEqual({ from: "2026-10-07", to: "2026-10-07" });
    expect(viewRange("week", "2026-10-07")).toEqual({ from: "2026-10-04", to: "2026-10-10" });
    expect(viewRange("week", "2026-10-04")).toEqual({ from: "2026-10-04", to: "2026-10-10" });
    expect(viewRange("week", "2026-10-10")).toEqual({ from: "2026-10-04", to: "2026-10-10" });
  });

  it("mes completo con las semanas parciales de los extremos", () => {
    expect(viewRange("month", "2026-10-15")).toEqual({ from: "2026-09-27", to: "2026-10-31" });
    expect(viewRange("month", "2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("nunca supera el máximo que acepta la consulta de rango", () => {
    for (let month = 1; month <= 12; month += 1) {
      const anchor = `2026-${String(month).padStart(2, "0")}-15`;
      const { from, to } = viewRange("month", anchor);
      expect(daysBetween(from, to)).toBeLessThan(42);
      expect(rangeQuerySchema.safeParse({ from, to }).success).toBe(true);
    }
  });
});

describe("cuadrícula del mes", () => {
  it("devuelve semanas completas de 7 días que empiezan en domingo", () => {
    const weeks = monthWeeks("2026-10-15");
    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0]).toBe("2026-09-27");
    expect(weeks[4][6]).toBe("2026-10-31");
  });

  it("usa seis semanas cuando el mes lo necesita y cuatro en un febrero exacto", () => {
    expect(monthWeeks("2026-08-10")).toHaveLength(6);
    expect(monthWeeks("2026-02-10")).toHaveLength(4);
  });

  it("marca qué días pertenecen al mes mostrado", () => {
    expect(isInSameMonth("2026-10-01", "2026-10-31")).toBe(true);
    expect(isInSameMonth("2026-09-30", "2026-10-01")).toBe(false);
  });

  it("lista los siete días de la semana", () => {
    expect(weekDates("2026-10-07")).toEqual([
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
    ]);
  });
});

describe("navegación", () => {
  it("mueve un día, una semana o un mes", () => {
    expect(shiftAnchor("day", "2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftAnchor("day", "2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftAnchor("week", "2026-10-07", 1)).toBe("2026-10-14");
    expect(shiftAnchor("week", "2026-10-07", -1)).toBe("2026-09-30");
    expect(shiftAnchor("month", "2026-10-07", 1)).toBe("2026-11-07");
    expect(shiftAnchor("month", "2026-10-07", -1)).toBe("2026-09-07");
  });

  it("ajusta el día cuando el mes destino es más corto y cruza el año", () => {
    expect(shiftAnchor("month", "2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftAnchor("month", "2026-03-31", -1)).toBe("2026-02-28");
    expect(shiftAnchor("month", "2026-12-15", 1)).toBe("2027-01-15");
    expect(shiftAnchor("month", "2026-01-15", -1)).toBe("2025-12-15");
  });
});

describe("textos de fecha", () => {
  it("titula cada vista", () => {
    expect(viewTitle("day", "2026-10-07")).toBe("Mié 7 de octubre de 2026");
    expect(viewTitle("month", "2026-10-07")).toBe("Octubre de 2026");
    expect(viewTitle("week", "2026-10-07")).toBe("4 – 10 de octubre de 2026");
    expect(viewTitle("week", "2026-09-30")).toBe("27 sep – 3 oct 2026");
    expect(viewTitle("week", "2026-12-30")).toBe("27 dic 2026 – 2 ene 2027");
  });

  it("etiqueta un día de forma corta", () => {
    expect(formatDayLabel("2026-10-07")).toBe("Mié 7 oct");
    expect(formatDayLabel("2026-10-04")).toBe("Dom 4 oct");
  });

  it("saca las iniciales de un nombre", () => {
    expect(initialsOf("Carlos Betancourt")).toBe("CB");
    expect(initialsOf("  yolanda   hernández  de la cruz")).toBe("YH");
    expect(initialsOf("Juancho")).toBe("J");
    expect(initialsOf("   ")).toBe("?");
  });
});

describe("resumen de citas", () => {
  it("cuenta por estado, excluye canceladas del total y reporta los solapes", () => {
    const summary = summarize(
      [
        { id: "1", status: "not_confirmed" },
        { id: "2", status: "confirmed" },
        { id: "3", status: "confirmed" },
        { id: "4", status: "rescheduled" },
        { id: "5", status: "completed" },
        { id: "6", status: "cancelled" },
      ],
      ["2", "3"],
    );
    expect(summary).toEqual({
      total: 5,
      notConfirmed: 1,
      confirmed: 2,
      rescheduled: 1,
      completed: 1,
      cancelled: 1,
      overlaps: 2,
    });
  });

  it("devuelve ceros sin citas", () => {
    expect(summarize([], [])).toEqual({
      total: 0,
      notConfirmed: 0,
      confirmed: 0,
      rescheduled: 0,
      completed: 0,
      cancelled: 0,
      overlaps: 0,
    });
  });
});

describe("datos del cliente en pantalla", () => {
  it("formatea teléfonos de Estados Unidos y conserva los demás", () => {
    expect(formatPhone("3055550142")).toBe("(305) 555-0142");
    expect(formatPhone("305-555-0142")).toBe("(305) 555-0142");
    expect(formatPhone("+1 (305) 555 0142")).toBe("+1 (305) 555-0142");
    expect(formatPhone(" 555-0142 ")).toBe("555-0142");
    expect(formatPhone("+58 414 1234567")).toBe("+58 414 1234567");
  });

  it("asigna siempre el mismo color a un mismo cliente, dentro del rango", () => {
    expect(avatarTone("CLI-1001")).toBe(avatarTone("CLI-1001"));
    for (const seed of ["CLI-1001", "CLI-1002", "CLI-1003", "Zoë", ""]) {
      const tone = avatarTone(seed);
      expect(tone).toBeGreaterThanOrEqual(0);
      expect(tone).toBeLessThan(AVATAR_TONES);
    }
    const tones = new Set(Array.from({ length: 30 }, (_, index) => avatarTone(`CLI-${1000 + index}`)));
    expect(tones.size).toBeGreaterThan(2);
  });
});

describe("disposición de citas que se pisan en el día", () => {
  it("deja cada cita a todo el ancho cuando no hay solapes", () => {
    const layout = layoutSlots([
      { id: "a", startMin: 540, durationMin: 60 },
      { id: "b", startMin: 600, durationMin: 60 },
      { id: "c", startMin: 720, durationMin: 30 },
    ]);
    for (const id of ["a", "b", "c"]) expect(layout.get(id)).toEqual({ column: 0, columns: 1 });
  });

  it("reparte en columnas las citas que se solapan", () => {
    const layout = layoutSlots([
      { id: "a", startMin: 540, durationMin: 60 },
      { id: "b", startMin: 570, durationMin: 60 },
    ]);
    expect(layout.get("a")).toEqual({ column: 0, columns: 2 });
    expect(layout.get("b")).toEqual({ column: 1, columns: 2 });
  });

  it("reutiliza columnas y mantiene juntos los solapes en cadena", () => {
    const layout = layoutSlots([
      { id: "a", startMin: 540, durationMin: 120 },
      { id: "b", startMin: 560, durationMin: 30 },
      { id: "c", startMin: 600, durationMin: 30 },
      { id: "d", startMin: 700, durationMin: 60 },
    ]);
    expect(layout.get("a")).toEqual({ column: 0, columns: 2 });
    expect(layout.get("b")).toEqual({ column: 1, columns: 2 });
    expect(layout.get("c")).toEqual({ column: 1, columns: 2 });
    expect(layout.get("d")).toEqual({ column: 0, columns: 1 });
  });

  it("trata las citas cortas con su altura visual mínima y no depende del orden de entrada", () => {
    const forward = layoutSlots([
      { id: "a", startMin: 540, durationMin: 10 },
      { id: "b", startMin: 555, durationMin: 10 },
    ]);
    const backward = layoutSlots([
      { id: "b", startMin: 555, durationMin: 10 },
      { id: "a", startMin: 540, durationMin: 10 },
    ]);
    expect(forward.get("b")).toEqual({ column: 1, columns: 2 });
    expect([...backward.entries()].sort()).toEqual([...forward.entries()].sort());
  });

  it("devuelve un mapa vacío sin citas y no solapa citas contiguas", () => {
    expect(layoutSlots([]).size).toBe(0);
    const layout = layoutSlots([
      { id: "a", startMin: 540, durationMin: 60 },
      { id: "b", startMin: 600, durationMin: 60 },
    ]);
    expect(layout.get("b")).toEqual({ column: 0, columns: 1 });
  });
});

describe("encabezados y horarios", () => {
  it("separa el título de cada vista en dos niveles", () => {
    expect(viewHeading("day", "2026-10-07")).toEqual({ primary: "Miércoles 7", secondary: "octubre de 2026" });
    expect(viewHeading("week", "2026-10-07")).toEqual({ primary: "4 – 10 octubre", secondary: "2026" });
    expect(viewHeading("week", "2026-09-30")).toEqual({ primary: "27 sep – 3 oct", secondary: "2026" });
    expect(viewHeading("week", "2026-12-30")).toEqual({ primary: "27 dic – 2 ene", secondary: "2026 – 2027" });
    expect(viewHeading("month", "2026-10-07")).toEqual({ primary: "Octubre", secondary: "2026" });
  });

  it("muestra el rango de una cita sin repetir AM o PM", () => {
    expect(formatRange(540, 60)).toBe("9:00–10:00 AM");
    expect(formatRange(690, 90)).toBe("11:30 AM–1:00 PM");
    expect(formatRange(720, 30)).toBe("12:00–12:30 PM");
    expect(formatRange(1380, 90)).toBe("11:00 PM–12:30 AM");
  });

  it("calcula las horas fuera del turno de un técnico", () => {
    const shift = { shiftStartMin: 480, shiftEndMin: 1080, workDays: [1, 2, 3, 4, 5, 6] };
    expect(offShiftRanges(shift, "2026-10-07", 420, 1200)).toEqual([
      [420, 480],
      [1080, 1200],
    ]);
    expect(offShiftRanges(shift, "2026-10-04", 420, 1200)).toEqual([[420, 1200]]);
    expect(offShiftRanges({ ...shift, shiftStartMin: 420, shiftEndMin: 1200 }, "2026-10-07", 420, 1200)).toEqual([]);
    expect(offShiftRanges({ ...shift, shiftStartMin: 300, shiftEndMin: 1500 }, "2026-10-07", 420, 1200)).toEqual([]);
  });

  it("elige texto oscuro sobre colores claros y blanco sobre colores oscuros", () => {
    expect(readableOn("#DB962A")).toBe("#12181f");
    expect(readableOn("#4C5FE0")).toBe("#ffffff");
    expect(readableOn("#D63F63")).toBe("#ffffff");
    expect(readableOn("#ffffff")).toBe("#12181f");
    expect(readableOn("#000000")).toBe("#ffffff");
  });

  it("calcula los minutos desde medianoche en el horario de Miami", () => {
    expect(minutesNowIn("America/New_York", new Date("2026-10-07T16:30:00Z"))).toBe(12 * 60 + 30);
    expect(minutesNowIn("America/New_York", new Date("2026-01-07T05:05:00Z"))).toBe(5);
    expect(minutesNowIn("UTC", new Date("2026-10-07T00:00:00Z"))).toBe(0);
  });
});
