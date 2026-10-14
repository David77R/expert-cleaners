import type { AddressSnapshot, ServiceField } from "@/db/schema";

export type InvoiceSource = {
  code: string;
  date: string;
  startMin: number;
  priceCents: number;
  paymentStatus: "unpaid" | "paid";
  specs: Record<string, string | number>;
  destinationAddress: AddressSnapshot | null;
  billingAddress: AddressSnapshot | null;
  customer: { code: string; firstName: string; lastName: string };
  address: AddressSnapshot;
  service: { name: string; fields: ServiceField[] };
  items?: InvoiceSourceItem[];
  generatedAt: Date;
};

export type InvoiceSourceItem = {
  service: { name: string; fields: readonly ServiceField[] };
  specs: Record<string, string | number>;
  details?: Partial<Record<"color" | "size" | "dimensions" | "notes", string>>;
  priceCents: number;
};

const DETAIL_ORDER = [
  ["color", "Color"],
  ["size", "Tamaño"],
  ["dimensions", "Dimensiones"],
  ["notes", "Notas"],
] as const;

export type InvoiceLine = { name: string; specs: { label: string; value: string }[]; priceCents: number };

export type InvoiceData = {
  number: string;
  issuedAt: Date;
  appointmentCode: string;
  customerName: string;
  customerCode: string;
  billTo: string;
  serviceName: string;
  serviceDate: string;
  startMin: number;
  serviceAddress: string;
  destinationAddress: string | null;
  specs: { label: string; value: string }[];
  lines: InvoiceLine[];
  priceCents: number;
  paid: boolean;
};

export function invoiceNumber(appointmentCode: string): string {
  return appointmentCode.replace(/^SVC-/, "INV-");
}

export function formatAddress(address: Pick<AddressSnapshot, "line1" | "unit" | "city" | "state" | "zip">): string {
  const street = [address.line1, address.unit].filter((part) => part && part.trim().length > 0).join(", ");
  const region = [address.state, address.zip].filter((part) => part && part.trim().length > 0).join(" ");
  return [street, address.city, region].filter((part) => part.length > 0).join(", ");
}

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function describeSpecs(
  specs: Record<string, string | number>,
  fields: readonly ServiceField[],
): { label: string; value: string }[] {
  const known = fields
    .filter((field) => specs[field.key] !== undefined && specs[field.key] !== "")
    .map((field) => ({ label: field.label, value: String(specs[field.key]) }));
  const knownKeys = new Set(fields.map((field) => field.key));
  const extra = Object.entries(specs)
    .filter(([key, value]) => !knownKeys.has(key) && value !== "")
    .map(([key, value]) => ({ label: key, value: String(value) }));
  return [...known, ...extra];
}

export function buildInvoice(source: InvoiceSource): InvoiceData {
  const billing = source.billingAddress ?? source.address;
  const items =
    source.items && source.items.length > 0
      ? source.items
      : [{ service: source.service, specs: source.specs, priceCents: source.priceCents }];
  const lines = items.map((item) => ({
    name: item.service.name,
    specs: [
      ...describeSpecs(item.specs, item.service.fields),
      ...DETAIL_ORDER.filter(([key]) => "details" in item && item.details?.[key]).map(([key, label]) => ({
        label,
        value: ("details" in item && item.details?.[key]) || "",
      })),
    ],
    priceCents: item.priceCents,
  }));
  return {
    number: invoiceNumber(source.code),
    issuedAt: source.generatedAt,
    appointmentCode: source.code,
    customerName: `${source.customer.firstName} ${source.customer.lastName}`.trim(),
    customerCode: source.customer.code,
    billTo: formatAddress(billing),
    serviceName: lines[0].name,
    serviceDate: source.date,
    startMin: source.startMin,
    serviceAddress: formatAddress(source.address),
    destinationAddress: source.destinationAddress ? formatAddress(source.destinationAddress) : null,
    specs: lines[0].specs,
    lines,
    priceCents: source.priceCents,
    paid: source.paymentStatus === "paid",
  };
}
