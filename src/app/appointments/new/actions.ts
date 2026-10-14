"use server";

import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { services } from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import {
  appointmentFieldErrors,
  appointmentInputFromForm,
  readAppointmentForm,
  type AppointmentFormErrors,
  type AppointmentFormValues,
} from "@/domain/appointment-form";
import { readItemValues } from "@/domain/appointment-items";
import { createAppointmentSchema } from "@/domain/schemas";
import { calendarHref } from "@/lib/calendar-links";
import { createAppointment } from "@/server/appointments";
import { getActor } from "@/server/auth";

export type AppointmentFormState = {
  values: AppointmentFormValues;
  errors: AppointmentFormErrors;
  message?: string;
};

export async function createAppointmentAction(
  previous: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const values = readAppointmentForm(formData);
  const db = getDb();
  const ids = readItemValues(values)
    .map((item) => item.serviceId)
    .filter((id) => z.uuid().safeParse(id).success);
  const rows = ids.length > 0 ? await db.select().from(services).where(inArray(services.id, ids)) : [];
  const byId = new Map(rows.filter((row) => row.active).map((row) => [row.id, row]));

  const { input, itemErrors } = appointmentInputFromForm(values, (id) => byId.get(id));
  const parsed = createAppointmentSchema.safeParse(input);
  const errors: AppointmentFormErrors = {
    ...(parsed.success ? {} : appointmentFieldErrors(parsed.error.issues)),
    ...itemErrors,
  };
  if (Object.keys(errors).length > 0) return { values, errors };

  let created: Awaited<ReturnType<typeof createAppointment>>;
  try {
    created = await createAppointment(db, actor, input);
  } catch (error) {
    if (error instanceof DomainError) return { values, errors: {}, message: error.message };
    console.error(error);
    return { values, errors: {}, message: "No se pudo crear la cita. Inténtalo de nuevo." };
  }

  revalidatePath("/calendar");
  redirect(calendarHref({ date: values.date, appt: created.appointment.id }));
}
