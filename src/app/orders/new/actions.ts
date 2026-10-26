"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appointmentItems } from "@/db/schema";
import type { PickerCustomer } from "@/domain/appointment-form";
import { DomainError } from "@/domain/appointment-rules";
import {
  customerFieldErrors,
  customerInputFromForm,
  readCustomerForm,
  type CustomerFormErrors,
  type CustomerFormValues,
} from "@/domain/customer-form";
import { createAppointmentSchema, type CreateAppointmentInput } from "@/domain/schemas";
import { createAppointment } from "@/server/appointments";
import { getActor, getBrand } from "@/server/auth";
import { createCustomer } from "@/server/customers";

export type OrderResult =
  | { ok: true; id: string; code: string; date: string; conflicts: number; itemIds: string[] }
  | { ok: false; error: string };

export async function scheduleOrderAction(payload: CreateAppointmentInput): Promise<OrderResult> {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const parsed = createAppointmentSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Faltan datos del pedido: revisa cliente, servicios, fecha, hora y técnico." };
  }
  try {
    const db = getDb();
    const { appointment, conflicts } = await createAppointment(db, actor, parsed.data);
    const items = await db
      .select({ id: appointmentItems.id })
      .from(appointmentItems)
      .where(eq(appointmentItems.appointmentId, appointment.id))
      .orderBy(asc(appointmentItems.position));
    revalidatePath("/calendar");
    revalidatePath(`/customers/${appointment.customerId}`);
    return {
      ok: true,
      id: appointment.id,
      code: appointment.code,
      date: appointment.date,
      conflicts: conflicts.length,
      itemIds: items.map((item) => item.id),
    };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "No se pudo programar el pedido. Inténtalo de nuevo." };
  }
}

export type QuickCustomerState = {
  values?: CustomerFormValues;
  errors: CustomerFormErrors;
  message?: string;
  customer?: PickerCustomer;
  existing?: boolean;
  stamp: number;
};

export async function quickCreateCustomerAction(
  previous: QuickCustomerState,
  formData: FormData,
): Promise<QuickCustomerState> {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const values = readCustomerForm(formData);
  try {
    const created = await createCustomer(
      getDb(),
      actor.companyId,
      customerInputFromForm(values, (await getBrand()).location.state),
    );
    revalidatePath("/customers");
    return {
      errors: {},
      existing: created.existing,
      stamp: previous.stamp + 1,
      customer: {
        id: created.customer.id,
        code: created.customer.code,
        firstName: created.customer.firstName,
        lastName: created.customer.lastName,
        phone: created.customer.phone,
        addresses: created.addresses.map((address) => ({
          id: address.id,
          line1: address.line1,
          unit: address.unit,
          city: address.city,
          state: address.state,
          zip: address.zip,
        })),
      },
    };
  } catch (error) {
    if (error instanceof ZodError) return { values, errors: customerFieldErrors(error), stamp: previous.stamp };
    if (error instanceof DomainError) return { values, errors: {}, message: error.message, stamp: previous.stamp };
    console.error(error);
    return { values, errors: {}, message: "No se pudo crear el cliente. Inténtalo de nuevo.", stamp: previous.stamp };
  }
}
