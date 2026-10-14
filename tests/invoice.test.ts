import { describe, expect, it } from "vitest";
import type { AddressSnapshot, ServiceField } from "@/db/schema";
import {
  buildInvoice,
  describeSpecs,
  formatAddress,
  formatMoney,
  invoiceNumber,
  type InvoiceSource,
} from "@/domain/invoice";

function address(partial: Partial<AddressSnapshot> = {}): AddressSnapshot {
  return { line1: "123 Main St", unit: "", city: "Miami", state: "FL", zip: "33101", ...partial };
}

describe("invoiceNumber", () => {
  it("replaces the SVC- prefix with INV-", () => {
    expect(invoiceNumber("SVC-1042")).toBe("INV-1042");
  });

  it("leaves codes without the SVC- prefix untouched", () => {
    expect(invoiceNumber("OTHER-1")).toBe("OTHER-1");
  });
});

describe("formatAddress", () => {
  it("joins a full address with unit", () => {
    expect(formatAddress(address({ unit: "Apt 4B" }))).toBe("123 Main St, Apt 4B, Miami, FL 33101");
  });

  it("omits an empty unit instead of leaving a stray comma", () => {
    expect(formatAddress(address({ unit: "" }))).toBe("123 Main St, Miami, FL 33101");
  });

  it("omits missing state/zip cleanly", () => {
    expect(formatAddress(address({ state: "", zip: "" }))).toBe("123 Main St, Miami");
  });
});

describe("formatMoney", () => {
  it("formats cents as US dollars", () => {
    expect(formatMoney(150)).toBe("$1.50");
    expect(formatMoney(10000)).toBe("$100.00");
  });

  it("formats zero", () => {
    expect(formatMoney(0)).toBe("$0.00");
  });
});

describe("describeSpecs", () => {
  const fields: ServiceField[] = [
    { key: "rooms", label: "Habitaciones", type: "number", required: true },
    { key: "size", label: "Tamaño", type: "select", required: false, options: ["S", "M", "L"] },
  ];

  it("labels known fields using the catalog and skips empty values", () => {
    const result = describeSpecs({ rooms: 3, size: "" }, fields);
    expect(result).toEqual([{ label: "Habitaciones", value: "3" }]);
  });

  it("appends keys not in the catalog as extras, after the known ones", () => {
    const result = describeSpecs({ rooms: 3, size: "M", notes: "manchas" }, fields);
    expect(result).toEqual([
      { label: "Habitaciones", value: "3" },
      { label: "Tamaño", value: "M" },
      { label: "notes", value: "manchas" },
    ]);
  });
});

function source(partial: Partial<InvoiceSource> = {}): InvoiceSource {
  return {
    code: "SVC-2001",
    date: "2026-10-13",
    startMin: 600,
    priceCents: 12000,
    paymentStatus: "unpaid",
    specs: {},
    destinationAddress: null,
    billingAddress: null,
    customer: { code: "CUST-1", firstName: "Marta", lastName: "Suárez" },
    address: address(),
    service: { name: "Limpieza de alfombra", fields: [] },
    generatedAt: new Date("2026-10-13T12:00:00Z"),
    ...partial,
  };
}

describe("buildInvoice", () => {
  it("bills to the service address when there is no separate billing address", () => {
    const invoice = buildInvoice(source());
    expect(invoice.billTo).toBe(formatAddress(address()));
  });

  it("prefers the explicit billing address when one is set", () => {
    const billing = address({ city: "Hialeah" });
    const invoice = buildInvoice(source({ billingAddress: billing }));
    expect(invoice.billTo).toBe(formatAddress(billing));
  });

  it("reflects payment status as a boolean", () => {
    expect(buildInvoice(source({ paymentStatus: "paid" })).paid).toBe(true);
    expect(buildInvoice(source({ paymentStatus: "unpaid" })).paid).toBe(false);
  });

  it("derives the invoice number from the appointment code", () => {
    expect(buildInvoice(source({ code: "SVC-9" })).number).toBe("INV-9");
  });

  it("leaves destinationAddress null when the appointment has none", () => {
    expect(buildInvoice(source()).destinationAddress).toBeNull();
  });
});
