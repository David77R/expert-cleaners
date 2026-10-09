"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/appointment-rules";
import {
  customerFieldErrors,
  customerInputFromForm,
  readCustomerForm,
  type CustomerFormErrors,
  type CustomerFormValues,
} from "@/domain/customer-form";
import { getActor } from "@/server/auth";
import { createCustomer } from "@/server/customers";

export type CustomerFormState = {
  values: CustomerFormValues;
  errors: CustomerFormErrors;
  message?: string;
};

export async function createCustomerAction(
  previous: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const values = readCustomerForm(formData);
  let created: Awaited<ReturnType<typeof createCustomer>>;
  try {
    created = await createCustomer(getDb(), customerInputFromForm(values));
  } catch (error) {
    if (error instanceof ZodError) return { values, errors: customerFieldErrors(error) };
    if (error instanceof DomainError) return { values, errors: {}, message: error.message };
    console.error(error);
    return { values, errors: {}, message: "No se pudo crear el cliente. Inténtalo de nuevo." };
  }

  revalidatePath("/customers");
  const params = new URLSearchParams({ nuevo: "1" });
  if (created.duplicates.length > 0) params.set("dup", created.duplicates.map((match) => match.id).join(","));
  redirect(`/customers/${created.customer.id}?${params.toString()}`);
}
