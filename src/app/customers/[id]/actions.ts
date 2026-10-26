"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/domain/permissions";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/appointment-rules";
import { getActor } from "@/server/auth";
import { getPhotoStorage } from "@/server/storage";
import {
  addAddress,
  addCustomerNote,
  deleteAddress,
  deleteCustomer,
  findCustomerByCode,
  mergeCustomers,
  relocateAddress,
  updateAddress,
} from "@/server/customers";
import { DEFAULT_STATE, coordinatesFrom } from "@/domain/customer-form";
import type { ActionState } from "@/app/calendar/actions";
import type { VehicleSize } from "@/domain/vehicles";
import { createVehicle, deleteVehicle, updateVehicle } from "@/server/vehicles";

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

export async function deleteCustomerAction(customerId: string, formData: FormData): Promise<void> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!isAdmin(actor)) redirect(`/customers/${customerId}`);
  if (!z.uuid().safeParse(customerId).success) redirect("/customers");

  let storage: ReturnType<typeof getPhotoStorage> | undefined;
  try {
    storage = getPhotoStorage();
  } catch {
    storage = undefined;
  }

  try {
    await deleteCustomer(getDb(), actor, customerId, {
      confirmCode: String(formData.get("confirmCode") ?? ""),
      storage,
    });
  } catch (error) {
    if (!(error instanceof DomainError)) console.error(error);
    const code = error instanceof DomainError && error.code === "confirmation_required" ? "confirmar" : "no-eliminado";
    redirect(`/customers/${customerId}?error=${code}`);
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
  if (!isAdmin(actor)) return { error: "Solo el súper admin puede unir clientes." };

  const db = getDb();
  const chosen = String(formData.get("targetId") ?? "");
  const code = String(formData.get("targetCode") ?? "").trim();
  let targetId = z.uuid().safeParse(chosen).success ? chosen : "";
  if (code) {
    const found = await findCustomerByCode(db, actor.companyId, code);
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

function addressFromForm(formData: FormData) {
  const field = (name: string) => String(formData.get(name) ?? "").trim();
  return {
    line1: field("line1"),
    unit: field("unit"),
    city: field("city"),
    state: (field("state") || DEFAULT_STATE).toUpperCase(),
    zip: field("zip"),
    notes: field("notes"),
    ...coordinatesFrom(field("lat"), field("lng")),
  };
}

function addressFailure(error: unknown, previous: ActionState): ActionState {
  if (error instanceof ZodError) {
    return {
      error: "Revisa la dirección: calle, ciudad, estado y código postal son obligatorios.",
      stamp: previous.stamp,
    };
  }
  if (error instanceof DomainError) return { error: error.message, stamp: previous.stamp };
  console.error(error);
  return { error: "No se pudo guardar la dirección. Inténtalo de nuevo.", stamp: previous.stamp };
}

async function addressActor() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}

function afterAddressChange(customerId: string, previous: ActionState, notice?: string): ActionState {
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/calendar");
  revalidatePath("/appointments/[id]/edit", "page");
  return { notice, stamp: previous.stamp + 1 };
}

export async function addAddressAction(customerId: string, previous: ActionState, formData: FormData) {
  const { companyId } = await addressActor();
  try {
    const { notes, ...address } = addressFromForm(formData);
    const created = await addAddress(getDb(), companyId, customerId, { ...address, ...(notes ? { notes } : {}) });
    return afterAddressChange(
      customerId,
      previous,
      created.lat === null ? "Dirección agregada, pero no se pudo ubicar en el mapa." : undefined,
    );
  } catch (error) {
    return addressFailure(error, previous);
  }
}

export async function updateAddressAction(
  customerId: string,
  addressId: string,
  previous: ActionState,
  formData: FormData,
) {
  const { companyId } = await addressActor();
  try {
    const { notes, ...address } = addressFromForm(formData);
    const updated = await updateAddress(getDb(), companyId, customerId, addressId, {
      ...address,
      notes: notes || null,
    });
    return afterAddressChange(
      customerId,
      previous,
      updated.lat === null
        ? "Guardada, pero no se pudo ubicar en el mapa. Elige la dirección de las sugerencias."
        : undefined,
    );
  } catch (error) {
    return addressFailure(error, previous);
  }
}

export async function relocateAddressAction(customerId: string, addressId: string, previous: ActionState) {
  const { companyId } = await addressActor();
  try {
    const { found } = await relocateAddress(getDb(), companyId, customerId, addressId);
    return afterAddressChange(
      customerId,
      previous,
      !found
        ? "No se encontró una ubicación precisa. Edita la dirección y elígela de las sugerencias."
        : "Ubicación actualizada.",
    );
  } catch (error) {
    return addressFailure(error, previous);
  }
}

export async function deleteAddressAction(customerId: string, addressId: string, previous: ActionState) {
  const { companyId } = await addressActor();
  try {
    await deleteAddress(getDb(), companyId, customerId, addressId);
    return afterAddressChange(customerId, previous);
  } catch (error) {
    return addressFailure(error, previous);
  }
}

function vehicleFromForm(formData: FormData) {
  const field = (name: string) => String(formData.get(name) ?? "");
  return {
    make: field("make"),
    model: field("model"),
    year: field("year"),
    color: field("color"),
    plate: field("plate"),
    size: field("size") as VehicleSize,
    notes: field("notes"),
  };
}

function vehicleFailure(error: unknown, previous: ActionState): ActionState {
  if (error instanceof ZodError)
    return { error: error.issues[0]?.message ?? "Revisa el vehículo.", stamp: previous.stamp };
  if (error instanceof DomainError) return { error: error.message, stamp: previous.stamp };
  console.error(error);
  return { error: "No se pudo guardar el vehículo. Inténtalo de nuevo.", stamp: previous.stamp };
}

export async function addVehicleAction(customerId: string, previous: ActionState, formData: FormData) {
  const { companyId } = await addressActor();
  try {
    await createVehicle(getDb(), companyId, customerId, vehicleFromForm(formData));
    return afterAddressChange(customerId, previous);
  } catch (error) {
    return vehicleFailure(error, previous);
  }
}

export async function updateVehicleAction(
  customerId: string,
  vehicleId: string,
  previous: ActionState,
  formData: FormData,
) {
  const { companyId } = await addressActor();
  try {
    await updateVehicle(getDb(), companyId, customerId, vehicleId, vehicleFromForm(formData));
    return afterAddressChange(customerId, previous);
  } catch (error) {
    return vehicleFailure(error, previous);
  }
}

export async function deleteVehicleAction(customerId: string, vehicleId: string, previous: ActionState) {
  const { companyId } = await addressActor();
  try {
    await deleteVehicle(getDb(), companyId, customerId, vehicleId);
    return afterAddressChange(customerId, previous);
  } catch (error) {
    return vehicleFailure(error, previous);
  }
}
