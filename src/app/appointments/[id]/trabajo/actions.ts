"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/appointment-rules";
import type { DamageMark } from "@/domain/vehicle-care";
import { saveInspection, setChecklistTask } from "@/server/appointments";
import { requireActor } from "@/server/auth";

export type WorkResult = { ok: true } | { ok: false; error: string };

function failure(error: unknown, fallback: string): WorkResult {
  if (error instanceof DomainError) return { ok: false, error: error.message };
  if (error instanceof ZodError) return { ok: false, error: error.issues[0]?.message ?? fallback };
  console.error(error);
  return { ok: false, error: fallback };
}

function refresh(appointmentId: string) {
  revalidatePath(`/appointments/${appointmentId}/trabajo`);
  revalidatePath("/calendar");
}

export async function toggleTaskAction(
  appointmentId: string,
  itemId: string,
  task: string,
  done: boolean,
): Promise<WorkResult> {
  try {
    const actor = await requireActor();
    await setChecklistTask(getDb(), actor, appointmentId, { itemId, task, done });
  } catch (error) {
    return failure(error, "No se pudo guardar la tarea. Inténtalo de nuevo.");
  }
  refresh(appointmentId);
  return { ok: true };
}

export async function saveInspectionAction(
  appointmentId: string,
  itemId: string,
  marks: DamageMark[],
  notes: string,
): Promise<WorkResult> {
  try {
    const actor = await requireActor();
    await saveInspection(getDb(), actor, appointmentId, { itemId, marks, notes });
  } catch (error) {
    return failure(error, "No se pudo guardar la inspección. Inténtalo de nuevo.");
  }
  refresh(appointmentId);
  return { ok: true };
}
