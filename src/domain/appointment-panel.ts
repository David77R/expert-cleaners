import type { AppointmentStatus } from "@/db/schema";
import { canTransition } from "./appointment-rules";

export const CANCEL_REASON_LABELS: Record<string, string> = {
  customer_cancelled: "El cliente canceló",
  customer_requested_other_date: "El cliente pidió otra fecha",
  weather: "Clima",
  duplicate: "Cita duplicada",
  other: "Otro motivo",
};

export const STATUS_LABELS: Record<string, string> = {
  not_confirmed: "No confirmada",
  confirmed: "Confirmada",
  rescheduled: "Reprogramada",
  cancelled: "Cancelada",
  completed: "Completada",
};

const INVOICE_LABELS: Record<string, string> = {
  not_generated: "sin generar",
  generated: "generada",
  sent: "enviada",
};

export type PanelActions = {
  confirm: boolean;
  complete: boolean;
  pay: boolean;
  invoice: "generate" | "send" | null;
  reschedule: boolean;
  cancel: boolean;
};

export function panelActions(
  status: AppointmentStatus,
  paymentStatus: "unpaid" | "paid",
  invoiceStatus: "not_generated" | "generated" | "sent",
): PanelActions {
  const cancelled = status === "cancelled";
  return {
    confirm: status === "not_confirmed" || status === "rescheduled",
    complete: canTransition(status, "completed"),
    pay: paymentStatus === "unpaid" && !cancelled,
    invoice: cancelled || invoiceStatus === "sent" ? null : invoiceStatus === "not_generated" ? "generate" : "send",
    reschedule: canTransition(status, "rescheduled"),
    cancel: canTransition(status, "cancelled"),
  };
}

export function parseTimeInput(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesToTimeInput(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function describeReason(value: string | null): string {
  if (!value) return "";
  if (value.startsWith("other: ")) return `Otro motivo: ${value.slice(7)}`;
  return CANCEL_REASON_LABELS[value] ?? value;
}

export function describeChange(
  entry: { field: string; fromValue: string | null; toValue: string | null },
  technicianNames: Readonly<Record<string, string>> = {},
): string {
  const { field, fromValue, toValue } = entry;
  const tech = (id: string | null) => (id ? (technicianNames[id] ?? "técnico") : "sin técnico");
  switch (field) {
    case "created":
      return "Cita creada";
    case "status":
      return `Estado: ${STATUS_LABELS[fromValue ?? ""] ?? fromValue} → ${STATUS_LABELS[toValue ?? ""] ?? toValue}`;
    case "schedule":
      return `Horario: ${fromValue} → ${toValue}`;
    case "start_time":
      return `Hora: ${fromValue} → ${toValue}`;
    case "technician":
      return `Técnico: ${tech(fromValue)} → ${tech(toValue)}`;
    case "payment":
      return "Pago registrado";
    case "invoice":
      return `Factura ${INVOICE_LABELS[toValue ?? ""] ?? toValue}`;
    case "notes":
      return toValue ? "Notas actualizadas" : "Notas eliminadas";
    case "cancellation_reason":
      return `Motivo de cancelación: ${describeReason(toValue)}`;
    case "reschedule_reason":
      return `Motivo de reprogramación: ${toValue}`;
    case "destination_address":
      return "Dirección de entrega actualizada";
    case "billing_address":
      return "Dirección de facturación actualizada";
    case "photo":
      return toValue === "removed" ? "Foto eliminada" : "Foto agregada";
    default:
      return field;
  }
}
