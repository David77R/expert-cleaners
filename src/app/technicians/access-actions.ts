"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/appointment-rules";
import { isAdmin } from "@/domain/permissions";
import { getActor } from "@/server/auth";
import { createTechnicianAccess, updateTechnicianAccess } from "@/server/technician-access";
import { getUserAdmin } from "@/server/user-admin";

export type AccessFormState = {
  ok?: boolean;
  message?: string;
  errors?: { email?: string; password?: string };
  email?: string;
};

async function adminActor() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!isAdmin(actor)) redirect("/calendar");
  return actor;
}

function failure(error: unknown, email: string): AccessFormState {
  if (error instanceof ZodError) {
    const errors: AccessFormState["errors"] = {};
    for (const issue of error.issues) {
      const field = issue.path[0];
      if (field === "email") errors.email ??= issue.message;
      if (field === "password") errors.password ??= issue.message;
    }
    return { errors, email };
  }
  if (error instanceof DomainError) {
    if (error.code === "email_taken") return { errors: { email: error.message }, email };
    if (error.code === "weak_password") return { errors: { password: error.message }, email };
    return { message: error.message, email };
  }
  console.error(error);
  return { message: "No se pudo guardar el usuario. Inténtalo de nuevo.", email };
}

export async function createTechnicianAccessAction(
  technicianId: string,
  _previous: AccessFormState,
  formData: FormData,
): Promise<AccessFormState> {
  const actor = await adminActor();
  const email = String(formData.get("email") ?? "");
  try {
    await createTechnicianAccess(getDb(), getUserAdmin(), actor, technicianId, {
      email,
      password: String(formData.get("password") ?? ""),
    });
  } catch (error) {
    return failure(error, email);
  }
  revalidatePath(`/technicians/${technicianId}`);
  return { ok: true, message: "Usuario creado. Ya puede entrar con ese correo y contraseña." };
}

export async function updateTechnicianAccessAction(
  technicianId: string,
  _previous: AccessFormState,
  formData: FormData,
): Promise<AccessFormState> {
  const actor = await adminActor();
  const email = String(formData.get("email") ?? "");
  try {
    await updateTechnicianAccess(getDb(), getUserAdmin(), actor, technicianId, {
      email,
      password: String(formData.get("password") ?? ""),
      active: formData.get("active") === "on",
    });
  } catch (error) {
    return failure(error, email);
  }
  revalidatePath(`/technicians/${technicianId}`);
  return { ok: true, message: "Cambios guardados." };
}
