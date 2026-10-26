import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db/client";
import { profiles, type Actor, type Company, type Profile } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DomainError } from "@/domain/appointment-rules";
import { ACTIVE_COMPANY_COOKIE, DEFAULT_COMPANY_SLUG, brandOf, type Brand } from "@/domain/companies";
import { assertAdmin } from "@/domain/permissions";
import { findCompany, findCompanyBySlug, listCompanies } from "@/server/companies";

export const INACTIVE_COMPANY_EXIT = "/salir?motivo=empresa";

const currentProfile = cache(async (): Promise<{ profile: Profile | null } | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const [profile] = await getDb().select().from(profiles).where(eq(profiles.id, data.user.id)).limit(1);
  return { profile: profile ?? null };
});

async function chosenCompany(): Promise<string | null> {
  const wanted = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value;
  if (!wanted) return null;
  const company = await findCompany(getDb(), wanted);
  return company?.id ?? null;
}

const activeCompany = cache(async (): Promise<Company | null> => {
  const session = await currentProfile();
  const profile = session?.profile;
  if (!profile?.active) return null;
  const id = profile.role === "owner" ? ((await chosenCompany()) ?? profile.companyId) : profile.companyId;
  return id ? findCompany(getDb(), id) : null;
});

export async function hasSession(): Promise<boolean> {
  return (await currentProfile()) !== null;
}

export async function getActor(): Promise<Actor | null> {
  const session = await currentProfile();
  if (!session) return null;
  const { profile } = session;
  if (!profile || !profile.active) redirect("/salir");
  const company = await activeCompany();
  if (profile.role !== "owner" && (!company || !company.active)) redirect(INACTIVE_COMPANY_EXIT);
  return { id: profile.id, name: profile.name, role: profile.role, companyId: company?.id ?? (await getBrand()).id };
}

export const getBrand = cache(async (): Promise<Brand> => {
  const db = getDb();
  const company =
    (await activeCompany()) ??
    (await findCompanyBySlug(db, process.env.NEXT_PUBLIC_CLIENT_ID || DEFAULT_COMPANY_SLUG)) ??
    (await listCompanies(db))[0];
  if (!company) throw new Error("No hay empresas registradas");
  return brandOf(company);
});

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new DomainError("unauthorized", "Inicia sesión para continuar");
  return actor;
}

export async function requireAdmin(): Promise<Actor> {
  const actor = await requireActor();
  assertAdmin(actor);
  return actor;
}
