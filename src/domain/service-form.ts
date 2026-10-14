import type { ZodError } from "zod";
import type { Service, ServiceField } from "@/db/schema";
import { isServiceIcon } from "./service-icons";
import { slugify } from "./service-rules";

export const SERVICE_TEXT_FIELDS = [
  "name",
  "category",
  "description",
  "price",
  "durationMin",
  "internalNotes",
  "detailedSpecs",
] as const;

export const MAX_SERVICE_FIELDS = 20;
export const MIN_DURATION = 0;
export const MAX_DURATION = 720;
export const MAX_PRICE_DOLLARS = 100_000;
export const FIELD_PREFIX = "field_";

const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

export type ServiceTextField = (typeof SERVICE_TEXT_FIELDS)[number];

export type FieldDraft = {
  key: string;
  label: string;
  type: ServiceField["type"];
  required: boolean;
  options: string;
};

export type ServiceFormValues = Record<ServiceTextField, string> & {
  icon: string;
  twoAddresses: boolean;
  active: boolean;
  fields: FieldDraft[];
};

export type FieldDraftErrors = { label?: string; options?: string };

export type ServiceFormErrors = Partial<Record<ServiceTextField | "fields", string>> & {
  rows?: Record<number, FieldDraftErrors>;
};

export function emptyFieldDraft(): FieldDraft {
  return { key: "", label: "", type: "number", required: false, options: "" };
}

export function emptyServiceForm(): ServiceFormValues {
  return {
    name: "",
    category: "",
    icon: "",
    description: "",
    price: "0",
    durationMin: "0",
    internalNotes: "",
    detailedSpecs: "",
    twoAddresses: false,
    active: true,
    fields: [],
  };
}

export function dollarsText(cents: number): string {
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, "0")}`;
}

export function serviceFormFromService(service: Service): ServiceFormValues {
  return {
    name: service.name,
    category: service.category,
    icon: service.icon ?? "",
    description: service.description ?? "",
    price: dollarsText(service.basePriceCents),
    durationMin: String(service.durationMin),
    internalNotes: service.internalNotes ?? "",
    detailedSpecs: service.detailedSpecs ?? "",
    twoAddresses: service.twoAddresses,
    active: service.active,
    fields: service.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      options: (field.options ?? []).join("\n"),
    })),
  };
}

function text(data: { get(name: string): FormDataEntryValue | null }, name: string): string {
  const entry = data.get(name);
  return typeof entry === "string" ? entry : "";
}

export function readServiceForm(data: { get(name: string): FormDataEntryValue | null }): ServiceFormValues {
  const values = emptyServiceForm();
  for (const field of SERVICE_TEXT_FIELDS) values[field] = text(data, field);
  values.icon = text(data, "icon");
  values.twoAddresses = data.get("twoAddresses") === "on";
  values.active = data.get("active") === "on";

  const requested = Number.parseInt(text(data, "fieldCount"), 10);
  const count = Number.isInteger(requested) ? Math.min(Math.max(requested, 0), MAX_SERVICE_FIELDS + 5) : 0;
  values.fields = Array.from({ length: count }, (_, index) => ({
    key: text(data, `${FIELD_PREFIX}${index}_key`),
    label: text(data, `${FIELD_PREFIX}${index}_label`),
    type: text(data, `${FIELD_PREFIX}${index}_type`) === "select" ? "select" : "number",
    required: data.get(`${FIELD_PREFIX}${index}_required`) === "on",
    options: text(data, `${FIELD_PREFIX}${index}_options`),
  }));
  return values;
}

export function parseDollars(raw: string): number | null {
  let cleaned = raw.trim().replace(/^\$\s*/, "");
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) cleaned = cleaned.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(cleaned)) cleaned = cleaned.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const dollars = Number(cleaned);
  if (dollars > MAX_PRICE_DOLLARS) return null;
  return Math.round(dollars * 100);
}

export function parseDuration(raw: string): number | null {
  const cleaned = raw.trim();
  if (!/^\d+$/.test(cleaned)) return null;
  const minutes = Number(cleaned);
  return minutes >= MIN_DURATION && minutes <= MAX_DURATION ? minutes : null;
}

export function parseOptions(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export function fieldKeyFromLabel(label: string): string {
  const words = slugify(label).split("-").filter(Boolean);
  if (words.length === 0) return "campo";
  const joined = words.map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1))).join("");
  return KEY_PATTERN.test(joined) ? joined : `campo${joined[0].toUpperCase()}${joined.slice(1)}`;
}

export function resolveFieldKeys(drafts: readonly FieldDraft[]): string[] {
  const taken = new Set<string>();
  const keys: (string | null)[] = drafts.map((draft) => {
    if (!KEY_PATTERN.test(draft.key) || taken.has(draft.key)) return null;
    taken.add(draft.key);
    return draft.key;
  });
  return keys.map((existing, index) => {
    if (existing) return existing;
    const base = fieldKeyFromLabel(drafts[index].label);
    let candidate = base;
    for (let suffix = 2; taken.has(candidate); suffix += 1) candidate = `${base}${suffix}`;
    taken.add(candidate);
    return candidate;
  });
}

function fieldRowErrors(drafts: readonly FieldDraft[]): Record<number, FieldDraftErrors> {
  const rows: Record<number, FieldDraftErrors> = {};
  const seen = new Set<string>();
  drafts.forEach((draft, index) => {
    const errors: FieldDraftErrors = {};
    const label = draft.label.trim();
    if (label === "") errors.label = "Escribe el nombre del campo";
    else if (seen.has(label.toLowerCase())) errors.label = "Ya hay un campo con este nombre";
    seen.add(label.toLowerCase());

    if (draft.type === "select") {
      const options = parseOptions(draft.options);
      if (options.length === 0) errors.options = "Agrega al menos una opción";
      else if (new Set(options).size !== options.length) errors.options = "Las opciones no pueden repetirse";
    }
    if (errors.label || errors.options) rows[index] = errors;
  });
  return rows;
}

export function validateServiceForm(values: ServiceFormValues): ServiceFormErrors {
  const errors: ServiceFormErrors = {};
  if (values.name.trim() === "") errors.name = "Escribe el nombre del servicio";
  if (values.category.trim() === "") errors.category = "Elige o escribe una categoría";
  if (parseDollars(values.price) === null) {
    errors.price = `Escribe un precio válido, por ejemplo 120 o 120.50 (máximo $${MAX_PRICE_DOLLARS.toLocaleString("en-US")})`;
  }
  if (parseDuration(values.durationMin) === null) {
    errors.durationMin = `La duración debe estar entre ${MIN_DURATION} y ${MAX_DURATION} minutos`;
  }
  if (values.fields.length > MAX_SERVICE_FIELDS) {
    errors.fields = `Un servicio admite hasta ${MAX_SERVICE_FIELDS} campos`;
  }
  const rows = fieldRowErrors(values.fields);
  if (Object.keys(rows).length > 0) errors.rows = rows;
  return errors;
}

export function hasErrors(errors: ServiceFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function blankToNull(value: string): string | null {
  return blankToUndefined(value) ?? null;
}

export function fieldsFromForm(values: ServiceFormValues): ServiceField[] {
  const keys = resolveFieldKeys(values.fields);
  return values.fields.map((draft, index) => {
    const field: ServiceField = {
      key: keys[index],
      label: draft.label.trim(),
      type: draft.type,
      required: draft.required,
    };
    if (draft.type === "select") field.options = parseOptions(draft.options);
    return field;
  });
}

export function createServiceInputFromForm(values: ServiceFormValues) {
  return {
    name: values.name,
    category: values.category,
    ...(isServiceIcon(values.icon) ? { icon: values.icon } : {}),
    description: blankToUndefined(values.description),
    basePriceCents: parseDollars(values.price) ?? 0,
    durationMin: parseDuration(values.durationMin) ?? 0,
    twoAddresses: values.twoAddresses,
    internalNotes: blankToUndefined(values.internalNotes),
    detailedSpecs: blankToUndefined(values.detailedSpecs),
    fields: fieldsFromForm(values),
  };
}

export function updateServiceInputFromForm(values: ServiceFormValues, options: { lockTwoAddresses: boolean }) {
  return {
    name: values.name,
    category: values.category,
    icon: isServiceIcon(values.icon) ? values.icon : null,
    description: blankToNull(values.description),
    basePriceCents: parseDollars(values.price) ?? 0,
    durationMin: parseDuration(values.durationMin) ?? 0,
    active: values.active,
    ...(options.lockTwoAddresses ? {} : { twoAddresses: values.twoAddresses }),
    internalNotes: blankToNull(values.internalNotes),
    detailedSpecs: blankToNull(values.detailedSpecs),
    fields: fieldsFromForm(values),
  };
}

const PATH_TO_FIELD: Record<string, ServiceTextField> = {
  name: "name",
  category: "category",
  description: "description",
  basePriceCents: "price",
  durationMin: "durationMin",
  internalNotes: "internalNotes",
  detailedSpecs: "detailedSpecs",
};

export function serviceFieldErrors(error: ZodError): ServiceFormErrors {
  const errors: ServiceFormErrors = {};
  for (const issue of error.issues) {
    const [root, index, leaf] = issue.path;
    if (root === "fields") {
      if (typeof index === "number") {
        const rows = (errors.rows ??= {});
        const row = (rows[index] ??= {});
        if (leaf === "options") row.options ??= issue.message;
        else row.label ??= "Revisa este campo";
      } else {
        errors.fields ??= "Revisa los campos del servicio";
      }
      continue;
    }
    const field = typeof root === "string" ? PATH_TO_FIELD[root] : undefined;
    if (field) errors[field] ??= "Revisa este dato";
  }
  return errors;
}

export function duplicateNameMessage(): string {
  return "Ya existe un servicio con este nombre";
}

export function groupByCategory<T extends { category: string }>(items: readonly T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const list = groups.get(item.category);
    if (list) list.push(item);
    else groups.set(item.category, [item]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "es"));
}

export function describeFieldCount(count: number): string {
  if (count === 0) return "Sin campos extra";
  return count === 1 ? "1 campo" : `${count} campos`;
}
