import { ZodError, type ZodIssue } from "zod";
import type { Actor } from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { parseTimeInput } from "@/domain/appointment-panel";
import { runAction } from "@/server/actions";
import type { Db } from "@/server/appointments";

export type PanelAction =
  "confirm" | "complete" | "mark_paid" | "advance_invoice" | "cancel" | "reschedule" | "update_notes" | "set_address";

export type ActionResult = { ok: true; notice?: string } | { ok: false; error: string };

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function payloadFromForm(action: PanelAction, form: FormData): Record<string, unknown> {
  switch (action) {
    case "cancel":
      return { action, reason: text(form, "reason"), explanation: text(form, "explanation") };
    case "reschedule":
      return {
        action,
        date: text(form, "date"),
        startMin: parseTimeInput(text(form, "time")) ?? undefined,
        technicianId: text(form, "technicianId") || undefined,
        reason: text(form, "reason"),
      };
    case "update_notes":
      return { action, notes: text(form, "notes").trim() };
    case "set_address":
      return { action, addressId: text(form, "addressId") };
    default:
      return { action };
  }
}

function friendlyIssue(issue: ZodIssue): string {
  switch (issue.path[0]) {
    case "reason":
      return issue.code === "invalid_value" ? "Elige un motivo de cancelación" : issue.message;
    case "date":
      return "Elige una fecha válida";
    case "startMin":
      return "Elige una hora válida";
    case "technicianId":
      return "Elige un técnico válido";
    case "addressId":
      return "Elige una dirección";
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
    if ((kind === "reschedule" || kind === "move") && result.conflicts.length > 0) {
      const count = result.conflicts.length;
      return {
        ok: true,
        notice: `${kind === "move" ? "Movida" : "Reprogramada"}. Se solapa con ${count} ${count === 1 ? "cita" : "citas"}: revisa el horario.`,
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
