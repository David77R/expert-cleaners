"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/appointment-rules";
import {
  agentFieldErrors,
  hasAgentErrors,
  readAgentForm,
  validateAgentForm,
  withoutPassword,
  type AgentFormErrors,
  type AgentFormValues,
} from "@/domain/agent-form";
import { createAgent, deleteAgent, updateAgent } from "@/server/agents";
import { getActor } from "@/server/auth";
import { getUserAdmin } from "@/server/user-admin";

export type AgentFormState = {
  values: AgentFormValues;
  errors: AgentFormErrors;
  message?: string;
};

async function adminActor() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "admin") redirect("/calendar");
  return actor;
}

function failure(error: unknown, values: AgentFormValues, fallback: string): AgentFormState {
  const safe = withoutPassword(values);
  if (error instanceof ZodError) return { values: safe, errors: agentFieldErrors(error) };
  if (error instanceof DomainError) {
    if (error.code === "email_taken") return { values: safe, errors: { email: error.message } };
    if (error.code === "weak_password") return { values: safe, errors: { password: error.message } };
    return { values: safe, errors: {}, message: error.message };
  }
  console.error(error);
  return { values: safe, errors: {}, message: fallback };
}

export async function createAgentAction(previous: AgentFormState, formData: FormData): Promise<AgentFormState> {
  const actor = await adminActor();
  const values = readAgentForm(formData);
  const errors = validateAgentForm(values, { passwordRequired: true });
  if (hasAgentErrors(errors)) return { values: withoutPassword(values), errors };

  let created: Awaited<ReturnType<typeof createAgent>>;
  try {
    created = await createAgent(getDb(), getUserAdmin(), actor, values);
  } catch (error) {
    return failure(error, values, "No se pudo crear el agente. Inténtalo de nuevo.");
  }

  revalidatePath("/agents");
  redirect(`/agents?aviso=creado&id=${created.id}`);
}

export async function updateAgentAction(
  id: string,
  previous: AgentFormState,
  formData: FormData,
): Promise<AgentFormState> {
  const actor = await adminActor();
  const values = readAgentForm(formData);
  if (!z.uuid().safeParse(id).success)
    return { values: withoutPassword(values), errors: {}, message: "El agente no existe." };

  const errors = validateAgentForm(values, { passwordRequired: false });
  if (hasAgentErrors(errors)) return { values: withoutPassword(values), errors };

  try {
    await updateAgent(getDb(), getUserAdmin(), actor, id, {
      name: values.name,
      email: values.email,
      password: values.password === "" ? undefined : values.password,
      active: values.active,
    });
  } catch (error) {
    return failure(error, values, "No se pudieron guardar los cambios. Inténtalo de nuevo.");
  }

  revalidatePath("/agents");
  redirect(`/agents?aviso=actualizado&id=${id}`);
}

export async function deleteAgentAction(id: string): Promise<void> {
  const actor = await adminActor();
  if (!z.uuid().safeParse(id).success) redirect("/agents");

  try {
    await deleteAgent(getDb(), getUserAdmin(), actor, id);
  } catch (error) {
    if (!(error instanceof DomainError)) console.error(error);
    redirect(`/agents/${id}?error=no-eliminado`);
  }

  revalidatePath("/agents");
  redirect("/agents?aviso=eliminado");
}
