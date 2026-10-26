"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/domain/permissions";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/appointment-rules";
import {
  hasTechnicianErrors,
  readTechnicianForm,
  technicianFieldErrors,
  technicianInputFromForm,
  validateTechnicianForm,
  type TechnicianFormErrors,
  type TechnicianFormValues,
} from "@/domain/technician-form";
import { getActor } from "@/server/auth";
import { createTechnician, deleteTechnician, updateTechnician } from "@/server/technicians";

export type TechnicianFormState = {
  values: TechnicianFormValues;
  errors: TechnicianFormErrors;
  message?: string;
};

async function adminActor() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!isAdmin(actor)) redirect("/calendar");
  return actor;
}

function failure(error: unknown, values: TechnicianFormValues, fallback: string): TechnicianFormState {
  if (error instanceof ZodError) return { values, errors: technicianFieldErrors(error) };
  if (error instanceof DomainError) {
    if (error.code === "name_taken") return { values, errors: { name: error.message } };
    return { values, errors: {}, message: error.message };
  }
  console.error(error);
  return { values, errors: {}, message: fallback };
}

function revalidateTechnicianViews() {
  revalidatePath("/technicians");
  revalidatePath("/calendar");
  revalidatePath("/appointments/new");
}

export async function createTechnicianAction(
  previous: TechnicianFormState,
  formData: FormData,
): Promise<TechnicianFormState> {
  const actor = await adminActor();
  const values = readTechnicianForm(formData);
  const errors = validateTechnicianForm(values);
  if (hasTechnicianErrors(errors)) return { values, errors };

  let created: Awaited<ReturnType<typeof createTechnician>>;
  try {
    created = await createTechnician(getDb(), actor, technicianInputFromForm(values));
  } catch (error) {
    return failure(error, values, "No se pudo crear el técnico. Inténtalo de nuevo.");
  }

  revalidateTechnicianViews();
  redirect(`/technicians?aviso=creado&id=${created.id}`);
}

export async function updateTechnicianAction(
  id: string,
  previous: TechnicianFormState,
  formData: FormData,
): Promise<TechnicianFormState> {
  const actor = await adminActor();
  const values = readTechnicianForm(formData);
  if (!z.uuid().safeParse(id).success) return { values, errors: {}, message: "El técnico no existe." };

  const errors = validateTechnicianForm(values);
  if (hasTechnicianErrors(errors)) return { values, errors };

  try {
    await updateTechnician(getDb(), actor, id, { ...technicianInputFromForm(values), active: values.active });
  } catch (error) {
    return failure(error, values, "No se pudieron guardar los cambios. Inténtalo de nuevo.");
  }

  revalidateTechnicianViews();
  redirect(`/technicians?aviso=actualizado&id=${id}`);
}

export async function deleteTechnicianAction(id: string): Promise<void> {
  const actor = await adminActor();
  if (!z.uuid().safeParse(id).success) redirect("/technicians");

  try {
    await deleteTechnician(getDb(), actor, id);
  } catch (error) {
    if (!(error instanceof DomainError)) console.error(error);
    redirect(`/technicians/${id}?error=no-eliminado`);
  }

  revalidateTechnicianViews();
  redirect("/technicians?aviso=eliminado");
}
