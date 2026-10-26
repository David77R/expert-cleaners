"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
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
import { ACTIVE_COMPANY_COOKIE } from "@/domain/companies";
import {
  companyFieldErrors,
  companyInputFromForm,
  readCompanyForm,
  validateCompanyForm,
  type CompanyFormErrors,
  type CompanyFormValues,
} from "@/domain/company-form";
import { isOwner } from "@/domain/permissions";
import { getActor } from "@/server/auth";
import { getBrandingStorage } from "@/server/branding";
import {
  createCompany,
  createCompanyAdmin,
  findCompany,
  removeCompanyLogo,
  setCompanyLogo,
  updateCompany,
} from "@/server/companies";
import { locateCity } from "@/server/geocoding";
import { getUserAdmin } from "@/server/user-admin";

export type CompanyFormState = { values: CompanyFormValues; errors: CompanyFormErrors; message?: string };
export type LogoState = { error?: string; notice?: string; stamp: number };
export type CompanyAdminState = { values: AgentFormValues; errors: AgentFormErrors; message?: string; notice?: string };

const ONE_YEAR = 60 * 60 * 24 * 365;

async function ownerActor() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!isOwner(actor)) redirect("/inicio");
  return actor;
}

function refresh() {
  revalidatePath("/", "layout");
}

async function remember(companyId: string) {
  (await cookies()).set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export async function switchCompanyAction(formData: FormData): Promise<void> {
  await ownerActor();
  const id = String(formData.get("companyId") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!z.uuid().safeParse(id).success || !(await findCompany(getDb(), id))) redirect("/empresas");
  await remember(id);
  refresh();
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/inicio");
}

function companyFailure(error: unknown, values: CompanyFormValues, fallback: string): CompanyFormState {
  if (error instanceof ZodError) return { values, errors: companyFieldErrors(error) };
  if (error instanceof DomainError) {
    if (error.code === "slug_taken") return { values, errors: { slug: error.message } };
    if (error.code === "city_not_found") return { values, errors: { city: error.message } };
    return { values, errors: {}, message: error.message };
  }
  console.error(error);
  return { values, errors: {}, message: fallback };
}

export async function createCompanyAction(previous: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const actor = await ownerActor();
  const values = readCompanyForm(formData);
  const errors = validateCompanyForm(values);
  if (Object.keys(errors).length > 0) return { values, errors };

  let id: string;
  try {
    id = (await createCompany(getDb(), actor, companyInputFromForm(values), locateCity)).id;
  } catch (error) {
    return companyFailure(error, values, "No se pudo crear la empresa. Inténtalo de nuevo.");
  }
  refresh();
  redirect(`/empresas/${id}?aviso=creada`);
}

export async function updateCompanyAction(
  id: string,
  previous: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const actor = await ownerActor();
  const values = readCompanyForm(formData);
  if (!z.uuid().safeParse(id).success) return { values, errors: {}, message: "La empresa no existe." };
  const errors = validateCompanyForm({ ...values, slug: values.slug || "empresa" });
  if (Object.keys(errors).length > 0) return { values, errors };

  try {
    await updateCompany(getDb(), actor, id, companyInputFromForm(values), locateCity);
  } catch (error) {
    return companyFailure(error, values, "No se pudieron guardar los cambios. Inténtalo de nuevo.");
  }
  refresh();
  redirect(`/empresas/${id}?aviso=guardada`);
}

export async function uploadLogoAction(id: string, previous: LogoState, formData: FormData): Promise<LogoState> {
  const actor = await ownerActor();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Elige una imagen para el logo.", stamp: previous.stamp };
  try {
    await setCompanyLogo(getDb(), getBrandingStorage(), actor, id, new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message, stamp: previous.stamp };
    console.error(error);
    return { error: "No se pudo guardar el logo. Inténtalo de nuevo.", stamp: previous.stamp };
  }
  refresh();
  return { notice: "Logo actualizado.", stamp: previous.stamp + 1 };
}

export async function removeLogoAction(id: string): Promise<void> {
  const actor = await ownerActor();
  try {
    await removeCompanyLogo(getDb(), actor, id);
  } catch (error) {
    if (!(error instanceof DomainError)) console.error(error);
  }
  refresh();
  redirect(`/empresas/${id}`);
}

export async function createCompanyAdminAction(
  companyId: string,
  previous: CompanyAdminState,
  formData: FormData,
): Promise<CompanyAdminState> {
  const actor = await ownerActor();
  const values = readAgentForm(formData);
  const errors = validateAgentForm(values, { passwordRequired: true });
  if (hasAgentErrors(errors)) return { values: withoutPassword(values), errors };
  try {
    await createCompanyAdmin(getDb(), getUserAdmin(), actor, companyId, values);
  } catch (error) {
    const safe = withoutPassword(values);
    if (error instanceof ZodError) return { values: safe, errors: agentFieldErrors(error) };
    if (error instanceof DomainError) {
      if (error.code === "email_taken") return { values: safe, errors: { email: error.message } };
      if (error.code === "weak_password") return { values: safe, errors: { password: error.message } };
      return { values: safe, errors: {}, message: error.message };
    }
    console.error(error);
    return { values: safe, errors: {}, message: "No se pudo crear el administrador. Inténtalo de nuevo." };
  }
  revalidatePath(`/empresas/${companyId}`);
  return {
    values: { name: "", email: "", password: "", active: true },
    errors: {},
    notice: `${values.name} ya puede entrar como administrador.`,
  };
}
