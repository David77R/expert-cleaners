import type { ZodError } from "zod";

export const FORM_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "notes",
  "line1",
  "unit",
  "city",
  "state",
  "zip",
  "addressNotes",
] as const;

export type CustomerFormField = (typeof FORM_FIELDS)[number];
export type CustomerFormValues = Record<CustomerFormField | "allowMarketing" | "lat" | "lng", string>;
export type CustomerFormErrors = Partial<Record<CustomerFormField, string>>;

export const DEFAULT_STATE = "FL";

const FIELD_MESSAGES: Partial<Record<CustomerFormField, string>> = {
  phone: "Escribe un teléfono válido (mínimo 7 dígitos)",
  email: "Escribe un correo válido",
  zip: "Escribe un código postal válido",
};

function isField(value: unknown): value is CustomerFormField {
  return typeof value === "string" && (FORM_FIELDS as readonly string[]).includes(value);
}

function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function emptyCustomerForm(): CustomerFormValues {
  return {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
    line1: "",
    unit: "",
    city: "",
    state: DEFAULT_STATE,
    zip: "",
    addressNotes: "",
    allowMarketing: "",
    lat: "",
    lng: "",
  };
}

export function readCustomerForm(data: { get(name: string): FormDataEntryValue | null }): CustomerFormValues {
  const values = emptyCustomerForm();
  for (const field of FORM_FIELDS) {
    const entry = data.get(field);
    values[field] = typeof entry === "string" ? entry : "";
  }
  values.allowMarketing = data.get("allowMarketing") === "on" ? "on" : "";
  for (const field of ["lat", "lng"] as const) {
    const entry = data.get(field);
    values[field] = typeof entry === "string" ? entry : "";
  }
  return values;
}

export function coordinatesFrom(rawLat: string | undefined, rawLng: string | undefined) {
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const valid = rawLat?.trim() && rawLng?.trim() && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90;
  return valid ? { lat, lng } : {};
}

export function customerInputFromForm(values: CustomerFormValues) {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    phone: values.phone,
    email: blankToUndefined(values.email),
    notes: blankToUndefined(values.notes),
    allowMarketing: values.allowMarketing === "on",
    addresses: [
      {
        line1: values.line1,
        unit: values.unit,
        city: values.city,
        state: (blankToUndefined(values.state) ?? DEFAULT_STATE).toUpperCase(),
        zip: values.zip,
        notes: blankToUndefined(values.addressNotes),
        ...coordinatesFrom(values.lat, values.lng),
      },
    ],
  };
}

function fieldFor(path: readonly PropertyKey[]): CustomerFormField | null {
  const [root, , leaf] = path;
  if (root === "addresses") {
    if (leaf === "notes") return "addressNotes";
    return isField(leaf) ? leaf : null;
  }
  return isField(root) ? root : null;
}

export function customerFieldErrors(error: ZodError): CustomerFormErrors {
  const errors: CustomerFormErrors = {};
  for (const issue of error.issues) {
    const field = fieldFor(issue.path);
    if (!field || errors[field]) continue;
    errors[field] = FIELD_MESSAGES[field] ?? "Este campo es obligatorio";
  }
  return errors;
}

export function parseDuplicateIds(raw: string | undefined, uuid: (value: string) => boolean, limit = 5): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").filter(uuid))].slice(0, limit);
}
