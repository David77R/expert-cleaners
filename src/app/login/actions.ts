"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credentials = z.object({ email: z.email(), password: z.string().min(6) });

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Revisa el correo y la contraseña" };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "user_banned") return { error: "Tu acceso está desactivado. Habla con el administrador." };
    if (error.code === "invalid_credentials") return { error: "Correo o contraseña incorrectos" };
    if (error.code === "email_not_confirmed") return { error: "Esta cuenta todavía no está confirmada." };
    console.error("Fallo al iniciar sesión", { code: error.code, status: error.status, message: error.message });
    return {
      error: `No se pudo conectar con el servicio de inicio de sesión (${error.code ?? error.status ?? "sin código"}). Avisa al administrador.`,
    };
  }
  redirect("/calendar");
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
