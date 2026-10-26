import type { ServiceField } from "@/db/schema";
import { needsPickup } from "./pickup";
import { ITEM_PREFIX, itemKey, readItemValues, validateItems } from "./appointment-items";
import { parseTimeInput } from "./appointment-panel";
import { serviceIconOf, type ServiceIconKey } from "./service-icons";
import { coordinatesFrom } from "./customer-form";
import type { SizePrices } from "./vehicles";

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
  slug?: string;
  iconKey?: ServiceIconKey;
  name: string;
  category: string;
  basePriceCents: number;
  durationMin: number;
  twoAddresses: boolean;
  fields: ServiceField[];
  sizePrices?: SizePrices;
};
export function toFormService(row: FormService & { icon?: string | null }): FormService {
  return {
    id: row.id,
    slug: row.slug,
    iconKey: serviceIconOf(row),
    name: row.name,
    category: row.category,
    basePriceCents: row.basePriceCents,
    durationMin: row.durationMin,
    twoAddresses: row.twoAddresses,
    fields: row.fields,
    sizePrices: row.sizePrices ?? {},
  };
}

export type FormTechnician = {
  id: string;
  name: string;
  color: string;
  zone: string;
  shiftStartMin: number;
  shiftEndMin: number;
};

export const DESTINATION_FIELDS = ["line1", "unit", "city", "state", "zip"] as const;
export const DESTINATION_PREFIX = "dest_";

const FIELD_MESSAGES: Record<string, string> = {
  customerId: "Elige un cliente",
  addressId: "Elige la dirección del servicio",
  technicianId: "Elige un técnico",
  date: "Elige una fecha válida",
  time: "Elige una hora válida",
  durationMin: "Escribe la duración en minutos, entre 0 y 720",
};

export function emptyAppointmentForm(state: string): AppointmentFormValues {
  return {
    customerId: "",
    addressId: "",
    technicianId: "",
    date: "",
    time: "",
    durationMin: "",
    notes: "",
    [`${DESTINATION_PREFIX}state`]: state,
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

export function destinationFromValues(values: AppointmentFormValues, defaultState: string) {
  const destination = (field: (typeof DESTINATION_FIELDS)[number]) =>
    (values[`${DESTINATION_PREFIX}${field}`] ?? "").trim();
  return {
    line1: destination("line1"),
    unit: destination("unit"),
    city: destination("city"),
    state: (destination("state") || defaultState).toUpperCase(),
    zip: destination("zip"),
    ...coordinatesFrom(values[`${DESTINATION_PREFIX}lat`], values[`${DESTINATION_PREFIX}lng`]),
  };
}

export function appointmentInputFromForm(
  values: AppointmentFormValues,
  findService: (id: string) => FormService | undefined,
  company: { defaultState: string; rugPickup: boolean },
) {
  const { inputs, errors } = validateItems(readItemValues(values), findService);
  const twoAddresses = inputs.some((item) => findService(item.serviceId)?.twoAddresses);
  const pickup = needsPickup(
    inputs.map((item) => findService(item.serviceId)),
    company.rugPickup,
  );
  const customDestination = pickup && (values[`${DESTINATION_PREFIX}line1`] ?? "").trim() !== "";
  const deliveryDate = (values.deliveryDate ?? "").trim();
  const delivery =
    pickup && deliveryDate
      ? {
          date: deliveryDate,
          startMin: parseTimeInput(values.deliveryTime) ?? Number.NaN,
          durationMin: Number((values.deliveryDuration ?? "").trim() || "0"),
          technicianId: values.deliveryTechnicianId ?? "",
        }
      : undefined;

  return {
    input: {
      customerId: values.customerId ?? "",
      addressId: values.addressId ?? "",
      technicianId: values.technicianId ?? "",
      date: values.date ?? "",
      startMin: parseTimeInput(values.time) ?? Number.NaN,
      durationMin: values.durationMin?.trim() === "" ? Number.NaN : Number(values.durationMin),
      items: inputs,
      notes: (values.notes ?? "").trim(),
      destinationAddress:
        twoAddresses || customDestination ? destinationFromValues(values, company.defaultState) : undefined,
      ...(delivery ? { delivery } : {}),
    },
    itemErrors: errors,
  };
}

function itemMessage(key: string): string {
  if (!key.startsWith(ITEM_PREFIX)) return "Este campo es obligatorio";
  return key.endsWith(".price") ? "Escribe un precio válido" : "Elige un servicio";
}

function keyFor(path: readonly PropertyKey[]): string | null {
  const [root, leaf, field] = path;
  if (root === "startMin") return "time";
  if (root === "delivery") return "deliveryDate";
  if (root === "items") {
    const index = typeof leaf === "number" ? leaf : 0;
    return itemKey(index, field === "priceCents" ? "price" : "serviceId");
  }
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
    errors[key] = FIELD_MESSAGES[key] ?? itemMessage(key);
  }
  return errors;
}
