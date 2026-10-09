import type { Actor } from "@/db/schema";
import { DomainError } from "./appointment-rules";

export function assertAdmin(actor: Actor): void {
  if (actor.role !== "admin") {
    throw new DomainError("forbidden", "Solo un administrador puede hacer esto");
  }
}

export function canDeletePhoto(actor: Actor, uploadedBy: string | null): boolean {
  return actor.role === "admin" || actor.id === uploadedBy;
}

export function assertCanDeletePhoto(actor: Actor, uploadedBy: string | null): void {
  if (canDeletePhoto(actor, uploadedBy)) return;
  throw new DomainError("forbidden", "Solo quien subió la foto o un administrador puede eliminarla");
}
