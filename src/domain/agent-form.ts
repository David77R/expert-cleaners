import type { ZodError } from "zod";
import { AGENT_PASSWORD_MIN } from "./schemas";

export type AgentFormField = "name" | "email" | "password";
export type AgentFormValues = { name: string; email: string; password: string; active: boolean };
export type AgentFormErrors = Partial<Record<AgentFormField, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emptyAgentForm(): AgentFormValues {
  return { name: "", email: "", password: "", active: true };
}

export function readAgentForm(data: { get(name: string): FormDataEntryValue | null }): AgentFormValues {
  const text = (name: string) => {
    const entry = data.get(name);
    return typeof entry === "string" ? entry : "";
  };
  return {
    name: text("name").trim(),
    email: text("email").trim().toLowerCase(),
    password: text("password"),
    active: data.get("active") === "on",
  };
}

export function validateAgentForm(values: AgentFormValues, options: { passwordRequired: boolean }): AgentFormErrors {
  const errors: AgentFormErrors = {};
  if (values.name === "") errors.name = "Escribe el nombre del agente";
  if (!EMAIL.test(values.email)) errors.email = "Escribe un correo válido";
  if (values.password === "") {
    if (options.passwordRequired) errors.password = "Escribe una contraseña temporal";
  } else if (values.password.length < AGENT_PASSWORD_MIN) {
    errors.password = `La contraseña debe tener al menos ${AGENT_PASSWORD_MIN} caracteres`;
  }
  return errors;
}

export function hasAgentErrors(errors: AgentFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function agentFieldErrors(error: ZodError): AgentFormErrors {
  const errors: AgentFormErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field !== "name" && field !== "email" && field !== "password") continue;
    errors[field] ??= issue.message;
  }
  return errors;
}

export function withoutPassword(values: AgentFormValues): AgentFormValues {
  return { ...values, password: "" };
}
