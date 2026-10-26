import { PDFName } from "pdf-lib";
import { EXPERT_BRAND } from "./brands";
import { EXPERT_CLEANERS_COMPANY_ID } from "@/domain/companies";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AGENT_JOSUE } from "@/db/seed-data";

vi.mock("@/server/geocoding", () => ({
  geocodeIfNeeded: async (address: unknown) => address,
  getGeocoder: () => null,
}));
import {
  buildInvoice,
  describeSpecs,
  formatAddress,
  formatMoney,
  invoiceNumber,
  type InvoiceSource,
} from "@/domain/invoice";
import {
  advanceInvoice,
  completeAppointment,
  createAppointment,
  getAppointment,
  markPaid,
  setBillingAddress,
  updateNotes,
} from "@/server/appointments";
import { renderInvoicePdf } from "@/server/invoice-pdf";
import { toPdfText } from "@/server/pdf-kit";
import { getInvoice, getInvoicePdf } from "@/server/invoices";
import { appointmentInput, createTestDb } from "./helpers";
import { hexOf, loadPdf, pageText } from "./pdf-helpers";

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.client.close();
});

const fields = [
  { key: "length", label: "Largo (ft)", type: "number" as const, required: true },
  { key: "carpetType", label: "Tipo de alfombra", type: "select" as const, required: true, options: ["Lana"] },
];

function source(overrides: Partial<InvoiceSource> = {}): InvoiceSource {
  return {
    code: "SVC-2031",
    date: "2026-10-12",
    startMin: 480,
    priceCents: 18000,
    paymentStatus: "unpaid",
    specs: { length: 14, carpetType: "Lana" },
    destinationAddress: null,
    billingAddress: null,
    customer: { code: "CLI-1001", firstName: "Andrés", lastName: "Peña" },
    address: { line1: "1450 SW 8th St", unit: "", city: "Miami", state: "FL", zip: "33135" },
    service: { name: "Limpieza de Alfombras", fields },
    generatedAt: new Date("2026-10-11T22:30:00Z"),
    ...overrides,
  };
}

describe("reglas de factura", () => {
  it("deriva el número de factura del código de la cita", () => {
    expect(invoiceNumber("SVC-2031")).toBe("INV-2031");
  });

  it("formatea direcciones omitiendo las partes vacías", () => {
    expect(formatAddress({ line1: "1450 SW 8th St", unit: "", city: "Miami", state: "FL", zip: "33135" })).toBe(
      "1450 SW 8th St, Miami, FL 33135",
    );
    expect(formatAddress({ line1: "9100 SW 87th Ave", unit: "Apt 4B", city: "Miami", state: "FL", zip: "33176" })).toBe(
      "9100 SW 87th Ave, Apt 4B, Miami, FL 33176",
    );
  });

  it("formatea dinero desde centavos", () => {
    expect(formatMoney(18000)).toBe("$180.00");
    expect(formatMoney(9550)).toBe("$95.50");
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("describe las especificaciones con sus etiquetas, en el orden del servicio", () => {
    expect(describeSpecs({ carpetType: "Lana", length: 14 }, fields)).toEqual([
      { label: "Largo (ft)", value: "14" },
      { label: "Tipo de alfombra", value: "Lana" },
    ]);
  });

  it("omite valores vacíos y conserva especificaciones de campos que ya no existen", () => {
    expect(describeSpecs({ length: "", carpetType: "Lana", legacy: "x" }, fields)).toEqual([
      { label: "Tipo de alfombra", value: "Lana" },
      { label: "legacy", value: "x" },
    ]);
  });

  it("factura a la dirección de facturación y, si no existe, a la del servicio", () => {
    expect(buildInvoice(source()).billTo).toBe("1450 SW 8th St, Miami, FL 33135");
    const billing = { line1: "1 Biscayne Blvd", unit: "", city: "Miami", state: "FL", zip: "33132" };
    expect(buildInvoice(source({ billingAddress: billing })).billTo).toBe("1 Biscayne Blvd, Miami, FL 33132");
  });

  it("incluye la dirección de entrega solo en servicios de dos direcciones", () => {
    expect(buildInvoice(source()).destinationAddress).toBeNull();
    const destination = { line1: "1200 Brickell Ave", unit: "Unit 3", city: "Miami", state: "FL", zip: "33131" };
    expect(buildInvoice(source({ destinationAddress: destination })).destinationAddress).toBe(
      "1200 Brickell Ave, Unit 3, Miami, FL 33131",
    );
  });

  it("marca como pagada según el estado de pago y no expone notas internas", () => {
    expect(buildInvoice(source()).paid).toBe(false);
    expect(buildInvoice(source({ paymentStatus: "paid" })).paid).toBe(true);
    expect(buildInvoice(source())).not.toHaveProperty("notes");
  });
});

describe("texto seguro para PDF", () => {
  const supported = new Set(Array.from({ length: 256 }, (_, index) => index).filter((code) => code >= 32));

  it("conserva acentos y eñes", () => {
    expect(toPdfText("Peña Núñez ¿Cómo?", supported)).toBe("Peña Núñez ¿Cómo?");
  });

  it("normaliza comillas y guiones tipográficos", () => {
    expect(toPdfText("O’Brien – “VIP”", supported)).toBe('O\'Brien - "VIP"');
  });

  it("sustituye caracteres no soportados y saltos de línea", () => {
    expect(toPdfText("Hola 😀\nmundo", supported)).toBe("Hola ? mundo");
  });
});

describe("PDF de factura", () => {
  it("genera un PDF válido de una página tamaño carta con metadatos del negocio", async () => {
    const bytes = await renderInvoicePdf(buildInvoice(source()), EXPERT_BRAND);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");

    const pdf = await loadPdf(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
    expect(pdf.getTitle()).toBe("Factura INV-2031");
    expect(pdf.getProducer()).toBe("Expert Cleaners");
    expect(pdf.getCreationDate()?.toISOString()).toBe("2026-10-11T22:30:00.000Z");
  });

  it("incluye número, cliente, servicio, total y estado de pago", async () => {
    const unpaid = await pageText(await renderInvoicePdf(buildInvoice(source()), EXPERT_BRAND));
    for (const expected of ["INV-2031", "Andrés Peña", "Limpieza de Alfombras", "$180.00", "PENDIENTE DE PAGO"]) {
      expect(unpaid).toContain(hexOf(expected));
    }

    const paid = await pageText(await renderInvoicePdf(buildInvoice(source({ paymentStatus: "paid" })), EXPERT_BRAND));
    expect(paid).toContain(hexOf("PAGADA"));
    expect(paid).not.toContain(hexOf("PENDIENTE DE PAGO"));
  });

  it("produce exactamente los mismos bytes para la misma factura", async () => {
    const first = await renderInvoicePdf(buildInvoice(source()), EXPERT_BRAND);
    const second = await renderInvoicePdf(buildInvoice(source()), EXPERT_BRAND);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });

  it("no falla con nombres con emojis o direcciones muy largas", async () => {
    const long = "Avenida ".repeat(30);
    const bytes = await renderInvoicePdf(
      buildInvoice(
        source({
          customer: { code: "CLI-9", firstName: "Zoë 😀", lastName: "O’Brien" },
          billingAddress: { line1: long, unit: "", city: "Miami", state: "FL", zip: "33131" },
        }),
      ),
      EXPERT_BRAND,
    );
    expect((await loadPdf(bytes)).getPageCount()).toBe(1);
  });

  it("no falla con emojis en la dirección ni en el servicio", async () => {
    const bytes = await renderInvoicePdf(
      buildInvoice(
        source({
          billingAddress: { line1: "Calle 😀 12", unit: "Apt 漢字", city: "Miami", state: "FL", zip: "33131" },
          service: { name: "Limpieza 🧼 profunda", fields },
          specs: { length: "14 📏", carpetType: "Lana" },
        }),
      ),
      EXPERT_BRAND,
    );
    const text = await pageText(bytes);
    expect(text).toContain(hexOf("Calle ? 12"));
    expect(text).toContain(hexOf("Limpieza"));
  });

  it("el recurso de contenido existe en la página", async () => {
    const pdf = await loadPdf(await renderInvoicePdf(buildInvoice(source()), EXPERT_BRAND));
    expect(pdf.getPage(0).node.Resources()?.has(PDFName.of("Font"))).toBe(true);
  });
});

describe("factura desde la base de datos", () => {
  it("no se puede obtener hasta que la factura se genera", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2027-02-01" }));
    await expect(getInvoice(ctx.db, EXPERT_CLEANERS_COMPANY_ID, appointment.id)).rejects.toMatchObject({
      code: "invoice_not_generated",
    });
    await expect(getInvoicePdf(ctx.db, EXPERT_CLEANERS_COMPANY_ID, appointment.id)).rejects.toMatchObject({
      code: "invoice_not_generated",
    });
  });

  it("usa la fecha en que se generó y se mantiene al enviarla", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2027-02-02" }));
    await advanceInvoice(ctx.db, AGENT_JOSUE, appointment.id);

    const detail = await getAppointment(ctx.db, EXPERT_CLEANERS_COMPANY_ID, appointment.id);
    const generated = detail.history.find((entry) => entry.field === "invoice" && entry.toValue === "generated")!;

    const first = await getInvoice(ctx.db, EXPERT_CLEANERS_COMPANY_ID, appointment.id);
    expect(first.issuedAt.getTime()).toBe(generated.createdAt.getTime());
    expect(first.number).toBe(appointment.code.replace("SVC-", "INV-"));

    await advanceInvoice(ctx.db, AGENT_JOSUE, appointment.id);
    const sent = await getInvoice(ctx.db, EXPERT_CLEANERS_COMPANY_ID, appointment.id);
    expect(sent.issuedAt.getTime()).toBe(generated.createdAt.getTime());
  });

  it("refleja cliente, servicio, precio, especificaciones y pago", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2027-02-03" }));
    await completeAppointment(ctx.db, AGENT_JOSUE, appointment.id);
    await markPaid(ctx.db, AGENT_JOSUE, appointment.id);
    await advanceInvoice(ctx.db, AGENT_JOSUE, appointment.id);

    const invoice = await getInvoice(ctx.db, EXPERT_CLEANERS_COMPANY_ID, appointment.id);
    expect(invoice.customerName).toBe("Andrés Molina");
    expect(invoice.customerCode).toBe("CLI-1001");
    expect(invoice.serviceName).toBe("Limpieza de Sofás");
    expect(invoice.priceCents).toBe(ctx.services.sofa.basePriceCents);
    expect(invoice.paid).toBe(true);
    expect(invoice.specs).toEqual([
      { label: "Tipo de sofá", value: "Tela" },
      { label: "Número de asientos", value: "3" },
    ]);
    expect(invoice.billTo).toBe("1450 SW 8th St, Miami, FL 33135");
  });

  it("factura a cualquier dirección y no filtra las notas de la cita", async () => {
    const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2027-02-04" }));
    await updateNotes(ctx.db, AGENT_JOSUE, appointment.id, "Código de portón 4821");
    await setBillingAddress(ctx.db, AGENT_JOSUE, appointment.id, {
      line1: "55 Collins Ave",
      unit: "PH",
      city: "Miami Beach",
      state: "FL",
      zip: "33139",
    });
    await advanceInvoice(ctx.db, AGENT_JOSUE, appointment.id);

    const { invoice, pdf } = await getInvoicePdf(ctx.db, EXPERT_CLEANERS_COMPANY_ID, appointment.id);
    expect(invoice.billTo).toBe("55 Collins Ave, PH, Miami Beach, FL 33139");
    const text = await pageText(pdf);
    expect(text).toContain(hexOf("55 Collins Ave, PH, Miami Beach, FL 33139"));
    expect(text).not.toContain(hexOf("4821"));
  });

  it("falla con not_found si la cita no existe", async () => {
    await expect(
      getInvoice(ctx.db, EXPERT_CLEANERS_COMPANY_ID, "00000000-0000-4000-8000-0000000000ff"),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
