"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/appointment-rules";
import { getActor } from "@/server/auth";
import { addCustomerNote, deleteCustomer, findCustomerByCode, mergeCustomers } from "@/server/customers";

export type NoteState = { error?: string; version: number };

export async function addNote(customerId: string, previous: NoteState, formData: FormData): Promise<NoteState> {
  const actor = await getActor();
  if (!actor) redirect("/login");

  try {
    await addCustomerNote(getDb(), actor, customerId, { text: formData.get("text") });
  } catch (error) {
    if (error instanceof ZodError)
      return { error: error.issues[0]?.message ?? "Nota no válida", version: previous.version };
    if (error instanceof DomainError) return { error: error.message, version: previous.version };
    console.error(error);
    return { error: "No se pudo guardar la nota. Inténtalo de nuevo.", version: previous.version };
  }

  revalidatePath(`/customers/${customerId}`);
  return { version: previous.version + 1 };
}

export async function deleteCustomerAction(customerId: string): Promise<void> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "admin") redirect(`/customers/${customerId}`);
  if (!z.uuid().safeParse(customerId).success) redirect("/customers");

  try {
    await deleteCustomer(getDb(), actor, customerId);
  } catch (error) {
    if (!(error instanceof DomainError)) console.error(error);
    redirect(`/customers/${customerId}?error=no-eliminado`);
  }

  revalidatePath("/customers");
  redirect("/customers?aviso=eliminado");
}

export type MergeState = { error?: string };

export async function mergeCustomerAction(
  customerId: string,
  previous: MergeState,
  formData: FormData,
): Promise<MergeState> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "admin") return { error: "Solo el súper admin puede unir clientes." };

  const db = getDb();
  const chosen = String(formData.get("targetId") ?? "");
  const code = String(formData.get("targetCode") ?? "").trim();
  let targetId = z.uuid().safeParse(chosen).success ? chosen : "";
  if (code) {
    const found = await findCustomerByCode(db, code);
    if (!found) return { error: `No existe un cliente con el código ${code}.` };
    targetId = found.id;
  }
  if (!targetId) return { error: "Elige el cliente que se queda o escribe su código." };

  try {
    await mergeCustomers(db, actor, customerId, targetId);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    console.error(error);
    return { error: "No se pudieron unir los clientes. Inténtalo de nuevo." };
  }

  revalidatePath("/customers");
  revalidatePath("/calendar");
  redirect(`/customers/${targetId}?aviso=unido`);
}
