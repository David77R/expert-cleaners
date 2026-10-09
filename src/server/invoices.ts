import type { Address, AddressSnapshot } from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { buildInvoice } from "@/domain/invoice";
import { getAppointment, type Db } from "@/server/appointments";
import { renderInvoicePdf } from "@/server/invoice-pdf";

function toSnapshot(address: Address): AddressSnapshot {
  return {
    line1: address.line1,
    unit: address.unit,
    city: address.city,
    state: address.state,
    zip: address.zip,
    ...(address.notes ? { notes: address.notes } : {}),
    ...(address.lat !== null ? { lat: address.lat } : {}),
    ...(address.lng !== null ? { lng: address.lng } : {}),
  };
}

export async function getInvoice(db: Db, appointmentId: string) {
  const row = await getAppointment(db, appointmentId);
  if (row.invoiceStatus === "not_generated") {
    throw new DomainError("invoice_not_generated", "La factura aún no se ha generado");
  }

  const generation = row.history.find((entry) => entry.field === "invoice" && entry.toValue === "generated");
  const invoice = buildInvoice({
    code: row.code,
    date: row.date,
    startMin: row.startMin,
    priceCents: row.priceCents,
    paymentStatus: row.paymentStatus,
    specs: row.specs,
    destinationAddress: row.destinationAddress,
    billingAddress: row.billingAddress,
    customer: row.customer,
    address: toSnapshot(row.address),
    service: { name: row.service.name, fields: row.service.fields },
    generatedAt: generation?.createdAt ?? row.updatedAt,
  });
  return invoice;
}

export async function getInvoicePdf(db: Db, appointmentId: string) {
  const invoice = await getInvoice(db, appointmentId);
  return { invoice, pdf: await renderInvoicePdf(invoice) };
}
