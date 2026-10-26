import { ZodError, type ZodIssue } from "zod";
import type { Actor } from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { parseTimeInput } from "@/domain/appointment-panel";
import { itemsPayloadFromValues } from "@/domain/appointment-items";
import { DESTINATION_PREFIX, destinationFromValues, readAppointmentForm } from "@/domain/appointment-form";
import { runAction } from "@/server/actions";
import type { Db } from "@/server/appointments";

export type PanelAction =
  | "confirm"
  | "unconfirm"
  | "complete"
  | "mark_paid"
  | "advance_invoice"
  | "cancel"
  | "reschedule"
  | "update_notes"
  | "set_address"
  | "update_items"
  | "set_stage"
  | "set_ready_date"
  | "schedule_delivery"
  | "clear_delivery"
  | "set_destination";

export type ActionResult = { ok: true; notice?: string } | { ok: false; error: string };

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function payloadFromForm(action: PanelAction, form: FormData, defaultState: string): Record<string, unknown> {
  switch (action) {
    case "cancel":
      return { action, reason: text(form, "reason"), explanation: text(form, "explanation") };
    case "reschedule":
      return {
        action,
        date: text(form, "date"),
        startMin: parseTimeInput(text(form, "time")) ?? undefined,
        ...(text(form, "durationMin").trim() === "" ? {} : { durationMin: Number(text(form, "durationMin")) }),
        technicianId: text(form, "technicianId") || undefined,
        reason: text(form, "reason"),
      };
    case "update_notes":
      return { action, notes: text(form, "notes").trim() };
    case "set_address":
      return { action, addressId: text(form, "addressId") };
    case "set_stage":
      return { action, stage: text(form, "stage"), done: text(form, "done") === "1" };
    case "set_destination": {
      if (text(form, "destinationMode") !== "custom") return { action, address: null };
      const lat = Number(text(form, "lat"));
      const lng = Number(text(form, "lng"));
      return {
        action,
        address: {
          line1: text(form, "line1"),
          unit: text(form, "unit"),
          city: text(form, "city"),
          state: text(form, "state") || defaultState,
          zip: text(form, "zip"),
          ...(text(form, "lat") && text(form, "lng") && Number.isFinite(lat) && Number.isFinite(lng)
            ? { lat, lng }
            : {}),
        },
      };
    }
    case "set_ready_date":
      return { action, readyDate: text(form, "readyDate") || null };
    case "schedule_delivery":
      return {
        action,
        date: text(form, "deliveryDate"),
        startMin: parseTimeInput(text(form, "deliveryTime")) ?? undefined,
        durationMin: Number(text(form, "deliveryDuration")),
        technicianId: text(form, "deliveryTechnicianId"),
      };
    case "update_items": {
      const values = readAppointmentForm(form);
      return {
        action,
        ...itemsPayloadFromValues(values),
        ...(`${DESTINATION_PREFIX}line1` in values
          ? { destinationAddress: destinationFromValues(values, defaultState) }
          : {}),
      };
    }
    default:
      return { action };
  }
}

function friendlyIssue(issue: ZodIssue): string {
  switch (issue.path[0]) {
    case "reason":
      return issue.code === "invalid_value" ? "Elige un motivo de cancelación" : issue.message;
    case "address":
      return "Completa la calle, la ciudad y el código postal de la entrega";
    case "date":
      return "Elige una fecha válida";
    case "startMin":
      return "Elige una hora válida";
    case "technicianId":
      return "Elige un técnico válido";
    case "addressId":
      return "Elige una dirección";
    case "readyDate":
      return "Elige una fecha válida";
    case "items":
      return issue.path.includes("priceCents")
        ? "Revisa los precios: deben ser números positivos"
        : issue.path.includes("serviceId")
          ? "Elige el servicio de cada artículo"
          : issue.message;
    case "durationMin":
      return "Escribe la duración en minutos, entre 0 y 720";
    case "destinationAddress":
      return "Completa la dirección de entrega";
    default:
      return issue.message;
  }
}

export async function executeAction(
  db: Db,
  actor: Actor,
  appointmentId: string,
  payload: unknown,
): Promise<ActionResult> {
  try {
    const result = await runAction(db, actor, appointmentId, payload);
    const kind = (payload as { action?: string })?.action;
    if (kind === "schedule_delivery" && result.conflicts.length > 0) {
      const count = result.conflicts.length;
      return {
        ok: true,
        notice: `Entrega programada. Tiene conflicto con ${count} ${count === 1 ? "cita" : "citas"} del técnico: revisa el horario.`,
      };
    }
    if ((kind === "reschedule" || kind === "move") && result.conflicts.length > 0) {
      const count = result.conflicts.length;
      return {
        ok: true,
        notice: `${kind === "move" ? "Movida" : "Reprogramada"}. Tiene conflicto con ${count} ${count === 1 ? "cita" : "citas"}: revisa el horario.`,
      };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof ZodError) return { ok: false, error: friendlyIssue(error.issues[0]) };
    if (error instanceof DomainError) {
      if (error.code === "invalid_transition") {
        return { ok: false, error: "Esta acción ya no está disponible para el estado actual de la cita." };
      }
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo completar la acción. Inténtalo de nuevo." };
  }
}
