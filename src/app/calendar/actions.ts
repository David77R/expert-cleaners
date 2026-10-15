"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { getActor } from "@/server/auth";
import { executeAction, payloadFromForm, type PanelAction } from "@/server/panel-actions";

export type ActionState = { error?: string; notice?: string; stamp: number };

async function run(id: string, previous: ActionState, action: PanelAction, formData: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const result = await executeAction(getDb(), actor, id, payloadFromForm(action, formData));
  revalidatePath("/calendar");
  revalidatePath(`/appointments/${id}/edit`);
  return result.ok
    ? { notice: result.notice, stamp: previous.stamp + 1 }
    : { error: result.error, stamp: previous.stamp };
}

export async function confirmAction(id: string, previous: ActionState, formData: FormData) {
  return run(id, previous, "confirm", formData);
}

export async function unconfirmAction(id: string, previous: ActionState, formData: FormData) {
  return run(id, previous, "unconfirm", formData);
}

export async function completeAction(id: string, previous: ActionState, formData: FormData) {
  return run(id, previous, "complete", formData);
}

export async function payAction(id: string, previous: ActionState, formData: FormData) {
  return run(id, previous, "mark_paid", formData);
}

export async function invoiceAction(id: string, previous: ActionState, formData: FormData) {
  return run(id, previous, "advance_invoice", formData);
}

export async function cancelAction(id: string, previous: ActionState, formData: FormData) {
  return run(id, previous, "cancel", formData);
}

export async function rescheduleAction(id: string, previous: ActionState, formData: FormData) {
  return run(id, previous, "reschedule", formData);
}

export async function notesAction(id: string, previous: ActionState, formData: FormData) {
  return run(id, previous, "update_notes", formData);
}

export async function addressAction(id: string, previous: ActionState, formData: FormData) {
  return run(id, previous, "set_address", formData);
}

export async function itemsAction(id: string, previous: ActionState, formData: FormData) {
  return run(id, previous, "update_items", formData);
}

export async function moveAppointmentAction(
  id: string,
  startMin: number,
  technicianId: string,
): Promise<{ ok: true; notice?: string } | { ok: false; error: string }> {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const result = await executeAction(getDb(), actor, id, { action: "move", startMin, technicianId });
  revalidatePath("/calendar");
  return result;
}

export async function stageAction(id: string, previous: ActionState, formData: FormData) {
  return run(id, previous, "set_stage", formData);
}

export async function readyDateAction(id: string, previous: ActionState, formData: FormData) {
  return run(id, previous, "set_ready_date", formData);
}

export async function deliveryAction(id: string, previous: ActionState, formData: FormData) {
  return run(id, previous, "schedule_delivery", formData);
}

export async function clearDeliveryAction(id: string, previous: ActionState, formData: FormData) {
  return run(id, previous, "clear_delivery", formData);
}
