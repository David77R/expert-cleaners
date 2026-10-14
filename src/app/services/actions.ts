"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/appointment-rules";
import {
  createServiceInputFromForm,
  duplicateNameMessage,
  hasErrors,
  readServiceForm,
  serviceFieldErrors,
  updateServiceInputFromForm,
  validateServiceForm,
  type ServiceFormErrors,
  type ServiceFormValues,
} from "@/domain/service-form";
import { getActor } from "@/server/auth";
import { countServiceAppointments, createService, deleteService, updateService } from "@/server/services";

export type ServiceFormState = {
  values: ServiceFormValues;
  errors: ServiceFormErrors;
  message?: string;
};

async function adminActor() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "admin") redirect("/calendar");
  return actor;
}

function failure(error: unknown, values: ServiceFormValues, fallback: string): ServiceFormState {
  if (error instanceof ZodError) return { values, errors: serviceFieldErrors(error) };
  if (error instanceof DomainError) {
    if (error.code === "slug_taken") return { values, errors: { name: duplicateNameMessage() } };
    return { values, errors: {}, message: error.message };
  }
  console.error(error);
  return { values, errors: {}, message: fallback };
}

export async function createServiceAction(previous: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  const actor = await adminActor();
  const values = readServiceForm(formData);
  const errors = validateServiceForm(values);
  if (hasErrors(errors)) return { values, errors };

  try {
    await createService(getDb(), actor, createServiceInputFromForm(values));
  } catch (error) {
    return failure(error, values, "No se pudo crear el servicio. Inténtalo de nuevo.");
  }

  revalidatePath("/services");
  revalidatePath("/orders/new");
  redirect("/orders/new?aviso=servicio-creado");
}

export async function updateServiceAction(
  id: string,
  previous: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const actor = await adminActor();
  const values = readServiceForm(formData);
  if (!z.uuid().safeParse(id).success) return { values, errors: {}, message: "El servicio no existe." };

  const errors = validateServiceForm(values);
  if (hasErrors(errors)) return { values, errors };

  try {
    const db = getDb();
    const locked = (await countServiceAppointments(db, id)) > 0;
    await updateService(db, actor, id, updateServiceInputFromForm(values, { lockTwoAddresses: locked }));
  } catch (error) {
    return failure(error, values, "No se pudieron guardar los cambios. Inténtalo de nuevo.");
  }

  revalidatePath("/services");
  revalidatePath("/orders/new");
  revalidatePath("/appointments/new");
  redirect("/orders/new?aviso=servicio-actualizado");
}

export type DeleteServiceState = { error?: string };

export async function deleteServiceAction(id: string, back: string): Promise<DeleteServiceState> {
  const actor = await adminActor();
  if (!z.uuid().safeParse(id).success) return { error: "El servicio no existe." };

  let mode: "deleted" | "retired";
  try {
    mode = (await deleteService(getDb(), actor, id)).mode;
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    console.error(error);
    return { error: "No se pudo eliminar el servicio. Inténtalo de nuevo." };
  }

  revalidatePath("/services");
  revalidatePath("/orders/new");
  revalidatePath("/appointments/new");
  const aviso = mode === "deleted" ? "servicio-eliminado" : "servicio-retirado";
  redirect(back === "services" ? `/services?aviso=${aviso}` : `/orders/new?aviso=${aviso}`);
}
