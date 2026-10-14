import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { profiles, type Actor } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DomainError } from "@/domain/appointment-rules";
import { assertAdmin } from "@/domain/permissions";

export async function getActor(): Promise<Actor | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const [profile] = await getDb().select().from(profiles).where(eq(profiles.id, data.user.id)).limit(1);
  if (!profile || !profile.active) redirect("/salir");
  return { id: profile.id, name: profile.name, role: profile.role };
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
