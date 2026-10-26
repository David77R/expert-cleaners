import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { companies, profiles, type Actor } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DomainError } from "@/domain/appointment-rules";
import { ACTIVE_COMPANY_COOKIE, EXPERT_CLEANERS_COMPANY_ID } from "@/domain/companies";
import { assertAdmin } from "@/domain/permissions";

async function ownerCompany(fallback: string | null): Promise<string> {
  const wanted = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value;
  if (wanted) {
    const [row] = await getDb().select({ id: companies.id }).from(companies).where(eq(companies.id, wanted)).limit(1);
    if (row) return row.id;
  }
  return fallback ?? EXPERT_CLEANERS_COMPANY_ID;
}

export async function getActor(): Promise<Actor | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const [profile] = await getDb().select().from(profiles).where(eq(profiles.id, data.user.id)).limit(1);
  if (!profile || !profile.active) redirect("/salir");
  if (profile.role === "owner") {
    return { id: profile.id, name: profile.name, role: profile.role, companyId: await ownerCompany(profile.companyId) };
  }
  if (!profile.companyId) redirect("/salir");
  return { id: profile.id, name: profile.name, role: profile.role, companyId: profile.companyId };
}

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
