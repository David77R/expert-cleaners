import { describe, expect, it } from "vitest";
import { availableSlots, bookingWindow, freeTechnicians, type BookingTechnician } from "@/domain/booking";

const ANA: BookingTechnician = {
  id: "ana",
  active: true,
  workDays: [1, 2, 3, 4, 5, 6],
  shiftStartMin: 480,
  shiftEndMin: 1080,
};
const LUIS: BookingTechnician = {
  id: "luis",
  active: true,
  workDays: [1, 2, 3, 4, 5],
  shiftStartMin: 540,
  shiftEndMin: 1020,
};

describe("ventana de reservas", () => {
  it("respeta el aviso mínimo aunque pase al día siguiente", () => {
    expect(bookingWindow("2026-11-02", 600, 12, 30)).toEqual({
      firstDate: "2026-11-02",
      earliestMin: 1320,
      lastDate: "2026-12-02",
    });
    expect(bookingWindow("2026-11-02", 1200, 12, 30)).toMatchObject({ firstDate: "2026-11-03", earliestMin: 480 });
  });
});

describe("técnicos libres", () => {
  it("descarta al que está ocupado, fuera de turno o no trabaja ese día", () => {
    const monday = "2026-11-02";
    const busy = [{ technicianId: "ana", startMin: 600, durationMin: 120 }];
    expect(freeTechnicians(monday, 600, 60, [ANA, LUIS], busy)).toEqual(["luis"]);
    expect(freeTechnicians(monday, 480, 60, [ANA, LUIS], busy)).toEqual(["ana"]);
    expect(freeTechnicians("2026-11-07", 600, 60, [ANA, LUIS], [])).toEqual(["ana"]);
  });

  it("ordena primero al que tiene menos trabajo ese día", () => {
    const busy = [{ technicianId: "ana", startMin: 480, durationMin: 60 }];
    expect(freeTechnicians("2026-11-02", 600, 60, [ANA, LUIS], busy)).toEqual(["luis", "ana"]);
  });
});

describe("horarios disponibles", () => {
  const window = bookingWindow("2026-11-01", 480, 12, 30);

  it("ofrece horas dentro del horario del negocio donde quepa el servicio", () => {
    const slots = availableSlots({
      date: "2026-11-02",
      hours: [480, 1080],
      stepMin: 60,
      durationMin: 180,
      technicians: [ANA],
      busy: [{ technicianId: "ana", startMin: 720, durationMin: 60 }],
      window,
    });
    expect(slots.map((slot) => slot.startMin)).toEqual([480, 540, 780, 840, 900]);
  });

  it("no ofrece días cerrados ni fuera de la ventana", () => {
    const base = { stepMin: 60, durationMin: 60, technicians: [ANA], busy: [], window };
    expect(availableSlots({ ...base, date: "2026-11-02", hours: null })).toEqual([]);
    expect(availableSlots({ ...base, date: "2027-01-15", hours: [480, 1080] })).toEqual([]);
  });

  it("el primer día solo muestra horas después del aviso mínimo", () => {
    const tight = bookingWindow("2026-11-02", 300, 6, 30);
    const slots = availableSlots({
      date: "2026-11-02",
      hours: [480, 1080],
      stepMin: 60,
      durationMin: 60,
      technicians: [ANA],
      busy: [],
      window: tight,
    });
    expect(slots[0].startMin).toBe(660);
  });
});
