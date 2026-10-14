import { describe, expect, it } from "vitest";
import { WEEKDAY_SHORT } from "@/domain/calendar-view";
import { createTechnicianSchema } from "@/domain/schemas";
import {
  describeWorkDays,
  emptyTechnicianForm,
  readTechnicianForm,
  suggestColor,
  technicianFieldErrors,
  technicianInputFromForm,
  validateTechnicianForm,
  TECHNICIAN_COLORS,
} from "@/domain/technician-form";

function formData(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const complete: [string, string][] = [
  ["name", "Mariela Pérez"],
  ["zone", "Miami Beach"],
  ["color", "#1F9D7A"],
  ["shiftStart", "08:00"],
  ["shiftEnd", "17:30"],
  ["workDays", "5"],
  ["workDays", "1"],
  ["workDays", "1"],
  ["workDays", "9"],
];

describe("formulario de técnicos", () => {
  it("lee el formulario, ordena los días y descarta valores inválidos", () => {
    const values = readTechnicianForm(formData(complete));
    expect(values.workDays).toEqual([1, 5]);
    expect(values.active).toBe(false);
    expect(validateTechnicianForm(values)).toEqual({});
  });

  it("convierte las horas a minutos para guardar", () => {
    const input = technicianInputFromForm(readTechnicianForm(formData(complete)));
    expect(input).toMatchObject({ shiftStartMin: 480, shiftEndMin: 1050, workDays: [1, 5] });
    expect(createTechnicianSchema.safeParse(input).success).toBe(true);
  });

  it("marca los campos obligatorios y un horario al revés", () => {
    const errors = validateTechnicianForm({
      ...emptyTechnicianForm(),
      shiftStart: "18:00",
      shiftEnd: "09:00",
      workDays: [],
    });
    expect(Object.keys(errors).sort()).toEqual(["name", "shiftEnd", "workDays", "zone"]);
  });

  it("traduce los errores del esquema a los campos del formulario", () => {
    const result = createTechnicianSchema.safeParse({
      name: "",
      zone: "Doral",
      color: "#000000",
      workDays: [1],
      shiftStartMin: 600,
      shiftEndMin: 540,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = technicianFieldErrors(result.error);
      expect(errors.name).toBeDefined();
      expect(errors.shiftEnd).toBeDefined();
    }
  });

  it("sugiere el primer color libre", () => {
    expect(suggestColor([])).toBe(TECHNICIAN_COLORS[0]);
    expect(suggestColor([TECHNICIAN_COLORS[0].toLowerCase()])).toBe(TECHNICIAN_COLORS[1]);
    expect(suggestColor([...TECHNICIAN_COLORS])).toBe(TECHNICIAN_COLORS[0]);
  });

  it("describe los días de trabajo de forma corta", () => {
    expect(describeWorkDays([0, 1, 2, 3, 4, 5, 6], WEEKDAY_SHORT)).toBe("Todos los días");
    expect(describeWorkDays([1, 2, 3, 4, 5, 6], WEEKDAY_SHORT)).toBe("Lunes a sábado");
    expect(describeWorkDays([1, 2, 3, 4, 5], WEEKDAY_SHORT)).toBe("Lunes a viernes");
    expect(describeWorkDays([0, 6], WEEKDAY_SHORT)).toBe("Sáb, Dom");
  });
});
