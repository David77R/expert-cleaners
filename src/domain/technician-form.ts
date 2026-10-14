import type { ZodError } from "zod";
import type { Technician } from "@/db/schema";
import { minutesToTimeInput, parseTimeInput } from "./appointment-panel";

export const TECHNICIAN_TEXT_FIELDS = ["name", "zone", "color", "shiftStart", "shiftEnd"] as const;
export type TechnicianTextField = (typeof TECHNICIAN_TEXT_FIELDS)[number];
export type TechnicianFormField = TechnicianTextField | "workDays";

export type TechnicianFormValues = Record<TechnicianTextField, string> & { workDays: number[]; active: boolean };
export type TechnicianFormErrors = Partial<Record<TechnicianFormField, string>>;

export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6];
export const DEFAULT_SHIFT_START = "07:00";
export const DEFAULT_SHIFT_END = "19:00";

export const TECHNICIAN_COLORS = [
  "#DB962A",
  "#4C5FE0",
  "#D63F63",
  "#1F9D7A",
  "#8B5CF6",
  "#0EA5E9",
  "#E4572E",
  "#64748B",
] as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function suggestColor(used: readonly string[]): string {
  const taken = new Set(used.map((color) => color.toLowerCase()));
  return TECHNICIAN_COLORS.find((color) => !taken.has(color.toLowerCase())) ?? TECHNICIAN_COLORS[0];
}

export function emptyTechnicianForm(color: string = TECHNICIAN_COLORS[0]): TechnicianFormValues {
  return {
    name: "",
    zone: "",
    color,
    shiftStart: DEFAULT_SHIFT_START,
    shiftEnd: DEFAULT_SHIFT_END,
    workDays: [...DEFAULT_WORK_DAYS],
    active: true,
  };
}

export function technicianFormFromTechnician(technician: Technician): TechnicianFormValues {
  return {
    name: technician.name,
    zone: technician.zone,
    color: technician.color,
    shiftStart: minutesToTimeInput(technician.shiftStartMin),
    shiftEnd: minutesToTimeInput(technician.shiftEndMin),
    workDays: [...technician.workDays],
    active: technician.active,
  };
}

export function readTechnicianForm(data: {
  get(name: string): FormDataEntryValue | null;
  getAll(name: string): FormDataEntryValue[];
}): TechnicianFormValues {
  const text = (name: string) => {
    const entry = data.get(name);
    return typeof entry === "string" ? entry : "";
  };
  const days = data
    .getAll("workDays")
    .map((entry) => (typeof entry === "string" ? Number(entry) : NaN))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return {
    name: text("name"),
    zone: text("zone"),
    color: text("color"),
    shiftStart: text("shiftStart"),
    shiftEnd: text("shiftEnd"),
    workDays: [...new Set(days)].sort((a, b) => a - b),
    active: data.get("active") === "on",
  };
}

export function validateTechnicianForm(values: TechnicianFormValues): TechnicianFormErrors {
  const errors: TechnicianFormErrors = {};
  if (values.name.trim() === "") errors.name = "Escribe el nombre del técnico";
  if (values.zone.trim() === "") errors.zone = "Escribe la zona que cubre";
  if (!HEX_COLOR.test(values.color)) errors.color = "Elige un color";
  const start = parseTimeInput(values.shiftStart);
  const end = parseTimeInput(values.shiftEnd);
  if (start === null) errors.shiftStart = "Escribe una hora válida";
  if (end === null) errors.shiftEnd = "Escribe una hora válida";
  else if (start !== null && end <= start) errors.shiftEnd = "La hora de salida debe ser después de la de entrada";
  if (values.workDays.length === 0) errors.workDays = "Elige al menos un día";
  return errors;
}

export function hasTechnicianErrors(errors: TechnicianFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function technicianInputFromForm(values: TechnicianFormValues) {
  return {
    name: values.name,
    zone: values.zone,
    color: values.color,
    workDays: values.workDays,
    shiftStartMin: parseTimeInput(values.shiftStart) ?? -1,
    shiftEndMin: parseTimeInput(values.shiftEnd) ?? -1,
  };
}

const FIELD_FOR_PATH: Record<string, TechnicianFormField> = {
  name: "name",
  zone: "zone",
  color: "color",
  workDays: "workDays",
  shiftStartMin: "shiftStart",
  shiftEndMin: "shiftEnd",
};

export function technicianFieldErrors(error: ZodError): TechnicianFormErrors {
  const errors: TechnicianFormErrors = {};
  for (const issue of error.issues) {
    const field = FIELD_FOR_PATH[String(issue.path[0])];
    if (!field || errors[field]) continue;
    errors[field] = issue.message;
  }
  return errors;
}

export function describeWorkDays(days: readonly number[], labels: readonly string[]): string {
  const ordered = WEEK_ORDER.filter((day) => days.includes(day));
  if (ordered.length === 7) return "Todos los días";
  if (ordered.length === 6 && !days.includes(0)) return "Lunes a sábado";
  if (ordered.length === 5 && !days.includes(0) && !days.includes(6)) return "Lunes a viernes";
  return ordered.map((day) => labels[day]).join(", ");
}
