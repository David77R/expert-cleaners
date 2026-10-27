"use server";

import { getDb } from "@/db/client";
import { isNavPreviewSection, type NavPreview } from "@/domain/nav-preview";
import { getActor } from "@/server/auth";
import { getNavPreview } from "@/server/nav-preview";

export type NavPreviewResult = { ok: true; preview: NavPreview } | { ok: false; message: string };

export async function loadNavPreview(section: string): Promise<NavPreviewResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, message: "Tu sesión terminó. Vuelve a iniciar sesión." };
  if (!isNavPreviewSection(section)) return { ok: false, message: "Esta sección no tiene resumen." };
  try {
    return { ok: true, preview: await getNavPreview(getDb(), actor, section) };
  } catch (error) {
    console.error("No se pudo cargar el resumen", section, error);
    return { ok: false, message: "No se pudo cargar el resumen. Puedes ir directo a la pantalla." };
  }
}
