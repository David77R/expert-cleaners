import type { ServiceField } from "@/db/schema";
import { parseTimeInput } from "./appointment-panel";
import { DEFAULT_STATE } from "./customer-form";

export type AppointmentFormValues = Record<string, string>;
export type AppointmentFormErrors = Record<string, string>;

export type PickerAddress = { id: string; line1: string; unit: string; city: string; state: string; zip: string };
export type PickerCustomer = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  phone: string;
  addresses: PickerAddress[];
};
export type FormService = {
  id: string;
  name: string;
  category: string;
  basePriceCents: number;
  durationMin: number;
  twoAddresses: boolean;
  fields: ServiceField[];
};
export type FormTechnician = {
  id: string;
  name: string;
  color: string;
  zone: string;
  shiftStartMin: number;
  shiftEndMin: number;
};

export const DESTINATION_FIELDS = ["line1", "unit", "city", "state", "zip"] as const;
export const SPEC_PREFIX = "spec_";
export const DESTINATION_PREFIX = "dest_";

const FIELD_MESSAGES: Record<string, string> = {
  customerId: "Elige un cliente",
  addressId: "Elige la dirección del servicio",
  serviceId: "Elige un servicio",
  technicianId: "Elige un técnico",
  date: "Elige una fecha válida",
  time: "Elige una hora válida",
  durationMin: "Escribe la duración en minutos, entre 15 y 720",
};

export function emptyAppointmentForm(): AppointmentFormValues {
  return {
    customerId: "",
    addressId: "",
    serviceId: "",
    technicianId: "",
    date: "",
    time: "",
    durationMin: "",
    notes: "",
    [`${DESTINATION_PREFIX}state`]: DEFAULT_STATE,
  };
}

export function readAppointmentForm(data: {
  entries(): Iterable<[string, FormDataEntryValue]>;
}): AppointmentFormValues {
  const values: AppointmentFormValues = {};
  for (const [key, value] of data.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

export function validateSpecs(values: AppointmentFormValues, fields: readonly ServiceField[]): AppointmentFormErrors {
  const errors: AppointmentFormErrors = {};
  for (const field of fields) {
    const key = `${SPEC_PREFIX}${field.key}`;
    const raw = (values[key] ?? "").trim();
    if (raw === "") {
      if (field.required) errors[key] = "Este campo es obligatorio";
      continue;
    }
    if (field.type === "number") {
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) errors[key] = "Escribe un número válido";
    } else if (!(field.options ?? []).includes(raw)) {
      errors[key] = "Elige una de las opciones";
    }
  }
  return errors;
}

export function appointmentInputFromForm(
  values: AppointmentFormValues,
  service: { fields: readonly ServiceField[]; twoAddresses: boolean },
) {
  const specs: Record<string, string | number> = {};
  for (const field of service.fields) {
    const raw = (values[`${SPEC_PREFIX}${field.key}`] ?? "").trim();
    if (raw === "") continue;
    specs[field.key] = field.type === "number" ? Number(raw) : raw;
  }

  const destination = (field: (typeof DESTINATION_FIELDS)[number]) =>
    (values[`${DESTINATION_PREFIX}${field}`] ?? "").trim();

  return {
    customerId: values.customerId ?? "",
    addressId: values.addressId ?? "",
    serviceId: values.serviceId ?? "",
    technicianId: values.technicianId ?? "",
    date: values.date ?? "",
    startMin: parseTimeInput(values.time) ?? Number.NaN,
    durationMin: values.durationMin?.trim() === "" ? Number.NaN : Number(values.durationMin),
    specs,
    notes: (values.notes ?? "").trim(),
    destinationAddress: service.twoAddresses
      ? {
          line1: destination("line1"),
          unit: destination("unit"),
          city: destination("city"),
          state: (destination("state") || DEFAULT_STATE).toUpperCase(),
          zip: destination("zip"),
        }
      : undefined,
  };
}

function keyFor(path: readonly PropertyKey[]): string | null {
  const [root, leaf] = path;
  if (root === "startMin") return "time";
  if (root === "destinationAddress") {
    return typeof leaf === "string" && (DESTINATION_FIELDS as readonly string[]).includes(leaf)
      ? `${DESTINATION_PREFIX}${leaf}`
      : null;
  }
  return typeof root === "string" && root in FIELD_MESSAGES ? root : null;
}

export function appointmentFieldErrors(issues: readonly { path: readonly PropertyKey[] }[]): AppointmentFormErrors {
  const errors: AppointmentFormErrors = {};
  for (const issue of issues) {
    const key = keyFor(issue.path);
    if (!key || errors[key]) continue;
    errors[key] = FIELD_MESSAGES[key] ?? "Este campo es obligatorio";
  }
  return errors;
}
