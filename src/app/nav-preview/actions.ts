"use server";

import { getDb } from "@/db/client";
import { getActor } from "@/server/auth";
import { canPreview, isNavPreviewSection, type NavPreview } from "@/domain/nav-preview";
import { getNavPreview } from "@/server/nav-preview";

export type NavPreviewResult = { ok: true; preview: NavPreview } | { ok: false; message: string };

export async function loadNavPreview(section: string): Promise<NavPreviewResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, message: "Tu sesión terminó. Vuelve a iniciar sesión." };
  if (!isNavPreviewSection(section) || !canPreview(actor, section)) {
    return { ok: false, message: "No tienes acceso a esta sección." };
  }
  try {
    return { ok: true, preview: await getNavPreview(getDb(), actor, section) };
  } catch (error) {
    console.error("No se pudo cargar el resumen de la sección", section, error);
    return { ok: false, message: "No se pudo cargar el resumen. Puedes ir directo a la pantalla." };
  }
}
