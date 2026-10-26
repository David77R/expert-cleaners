"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { profiles } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.email(),
  password: z.string().min(6),
  as: z.enum(["team", "owner"]).default("team"),
});

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Revisa el correo y la contraseña" };
  const { as, ...account } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(account);
  if (error) {
    if (error.code === "user_banned") return { error: "Tu acceso está desactivado. Habla con el administrador." };
    if (error.code === "invalid_credentials") return { error: "Correo o contraseña incorrectos" };
    if (error.code === "email_not_confirmed") return { error: "Esta cuenta todavía no está confirmada." };
    console.error("Fallo al iniciar sesión", { code: error.code, status: error.status, message: error.message });
    return {
      error: `No se pudo conectar con el servicio de inicio de sesión (${error.code ?? error.status ?? "sin código"}). Avisa al administrador.`,
    };
  }
  if (as === "owner") {
    const [profile] = await getDb()
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, data.user.id))
      .limit(1);
    if (profile?.role !== "owner") {
      await supabase.auth.signOut();
      return { error: "Esta cuenta no es de dueño. Elige «Usuario» para entrar a tu empresa." };
    }
    redirect("/empresas");
  }
  redirect("/inicio");
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
