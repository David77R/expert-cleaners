import type { ServiceField } from "@/db/schema";
import { formatMoney } from "./invoice";
import { slugify } from "./service-rules";

export const MAX_ITEMS = 10;
export const ITEM_PREFIX = "items.";

export const SOFA_DIMENSIONS: readonly ServiceField[] = [
  { key: "sofaLength", label: "Largo del sofá (pulgadas)", type: "number", required: false },
  { key: "sofaWidth", label: "Ancho del sofá (pulgadas)", type: "number", required: false },
];

const SOFA_WORDS = ["sofa", "sillon", "couch", "sectional", "seccional", "loveseat"];

type ServiceLike = { name: string; slug?: string; fields: readonly ServiceField[] };

export function isSofaService(service: { name: string; slug?: string }): boolean {
  const words = `${slugify(service.name)}-${service.slug ?? ""}`.split("-");
  return words.some((word) => SOFA_WORDS.some((sofa) => word === sofa || word === `${sofa}s` || word === `${sofa}es`));
}

function hasDimensions(fields: readonly ServiceField[]): boolean {
  return fields.some((field) => {
    const label = slugify(field.label);
    return (
      ["length", "width", "sofaLength", "sofaWidth"].includes(field.key) ||
      label.startsWith("largo") ||
      label.startsWith("ancho")
    );
  });
}

export function fieldsForService(service: ServiceLike): ServiceField[] {
  if (!isSofaService(service) || hasDimensions(service.fields)) return [...service.fields];
  return [...service.fields, ...SOFA_DIMENSIONS];
}

export type ItemValues = { serviceId: string; price: string; specs: Record<string, string> };
export type ItemInput = { serviceId: string; specs: Record<string, string | number>; priceCents?: number };
export type ItemErrors = Record<string, string>;

export function itemKey(index: number, field: "serviceId" | "price"): string {
  return `${ITEM_PREFIX}${index}.${field}`;
}

export function itemSpecKey(index: number, specKey: string): string {
  return `${ITEM_PREFIX}${index}.spec.${specKey}`;
}

export function readItemValues(values: Readonly<Record<string, string>>): ItemValues[] {
  const indexes = new Set<number>();
  for (const key of Object.keys(values)) {
    const match = /^items\.(\d+)\./.exec(key);
    if (match) indexes.add(Number(match[1]));
  }
  return [...indexes]
    .sort((a, b) => a - b)
    .map((index) => {
      const specPrefix = `${ITEM_PREFIX}${index}.spec.`;
      const specs: Record<string, string> = {};
      for (const [key, value] of Object.entries(values)) {
        if (key.startsWith(specPrefix)) specs[key.slice(specPrefix.length)] = value;
      }
      return {
        serviceId: (values[itemKey(index, "serviceId")] ?? "").trim(),
        price: values[itemKey(index, "price")] ?? "",
        specs,
      };
    });
}

export function parseDollars(raw: string): number | null {
  const clean = raw.replace(/[$,\s]/g, "");
  if (clean === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return Number.NaN;
  return Math.round(Number(clean) * 100);
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function validateItems(
  items: readonly ItemValues[],
  findService: (id: string) => ServiceLike | undefined,
): { inputs: ItemInput[]; errors: ItemErrors } {
  const errors: ItemErrors = {};
  const inputs: ItemInput[] = [];
  if (items.length === 0) errors[itemKey(0, "serviceId")] = "Agrega al menos un servicio";
  if (items.length > MAX_ITEMS) errors[itemKey(0, "serviceId")] = `Máximo ${MAX_ITEMS} servicios por cita`;

  items.forEach((item, index) => {
    const service = item.serviceId ? findService(item.serviceId) : undefined;
    if (!service) {
      errors[itemKey(index, "serviceId")] = "Elige un servicio";
      return;
    }
    const specs: Record<string, string | number> = {};
    for (const field of fieldsForService(service)) {
      const key = itemSpecKey(index, field.key);
      const raw = (item.specs[field.key] ?? "").trim();
      if (raw === "") {
        if (field.required) errors[key] = "Este campo es obligatorio";
        continue;
      }
      if (field.type === "number") {
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) errors[key] = "Escribe un número válido";
        else specs[field.key] = value;
      } else if (!(field.options ?? []).includes(raw)) {
        errors[key] = "Elige una de las opciones";
      } else {
        specs[field.key] = raw;
      }
    }
    const priceCents = parseDollars(item.price);
    if (priceCents !== null && Number.isNaN(priceCents)) {
      errors[itemKey(index, "price")] = "Escribe un precio válido, por ejemplo 120 o 120.50";
    }
    inputs.push({
      serviceId: item.serviceId,
      specs,
      ...(priceCents !== null && !Number.isNaN(priceCents) ? { priceCents } : {}),
    });
  });

  return { inputs, errors };
}

export function itemsTotal(items: readonly { priceCents: number }[]): number {
  return items.reduce((sum, item) => sum + item.priceCents, 0);
}

export function summarizeItems(items: readonly { serviceName: string; priceCents: number }[]): string {
  return items.map((item) => `${item.serviceName} ${formatMoney(item.priceCents)}`).join(" · ");
}

export function itemsPayloadFromValues(values: Readonly<Record<string, string>>) {
  const items = readItemValues(values).map((item) => {
    const specs: Record<string, string | number> = {};
    for (const [key, raw] of Object.entries(item.specs)) {
      const value = raw.trim();
      if (value !== "") specs[key] = /^\d+(\.\d+)?$/.test(value) ? Number(value) : value;
    }
    const priceCents = parseDollars(item.price);
    return { serviceId: item.serviceId, specs, ...(priceCents === null ? {} : { priceCents }) };
  });
  const duration = (values.durationMin ?? "").trim();
  return { items, ...(duration === "" ? {} : { durationMin: Number(duration) }) };
}

export function serviceLabel(appointment: {
  service: { name: string };
  items?: readonly { service: { name: string } }[];
}): string {
  const items = appointment.items ?? [];
  if (items.length <= 1) return items[0]?.service.name ?? appointment.service.name;
  return `${items[0].service.name} +${items.length - 1}`;
}
