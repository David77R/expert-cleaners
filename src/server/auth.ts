import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db/client";
import { profiles, type Actor, type Profile } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DomainError } from "@/domain/appointment-rules";
import { ACTIVE_COMPANY_COOKIE, DEFAULT_COMPANY_SLUG, brandOf, type Brand } from "@/domain/companies";
import { assertAdmin } from "@/domain/permissions";
import { findCompany, findCompanyBySlug, listCompanies } from "@/server/companies";

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

const activeCompanyId = cache(async (): Promise<string | null> => {
  const session = await currentProfile();
  const profile = session?.profile;
  if (!profile?.active) return null;
  if (profile.role === "owner") return (await chosenCompany()) ?? profile.companyId;
  return profile.companyId;
});

export async function getActor(): Promise<Actor | null> {
  const session = await currentProfile();
  if (!session) return null;
  const { profile } = session;
  if (!profile || !profile.active) redirect("/salir");
  if (profile.role !== "owner" && !profile.companyId) redirect("/salir");
  const companyId = (await activeCompanyId()) ?? (await getBrand()).id;
  return { id: profile.id, name: profile.name, role: profile.role, companyId };
}

export const getBrand = cache(async (): Promise<Brand> => {
  const db = getDb();
  const id = await activeCompanyId();
  const company =
    (id ? await findCompany(db, id) : null) ??
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
