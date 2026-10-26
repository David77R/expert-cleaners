import type { Actor } from "@/db/schema";
import { DomainError } from "./appointment-rules";

export function isAdmin(actor: Pick<Actor, "role">): boolean {
  return actor.role === "admin" || actor.role === "owner";
}

export function isOwner(actor: Pick<Actor, "role">): boolean {
  return actor.role === "owner";
}

export function assertAdmin(actor: Actor): void {
  if (!isAdmin(actor)) {
    throw new DomainError("forbidden", "Solo un administrador puede hacer esto");
  }
}

export function canDeletePhoto(actor: Actor, uploadedBy: string | null): boolean {
  return isAdmin(actor) || actor.id === uploadedBy;
}

export function assertCanDeletePhoto(actor: Actor, uploadedBy: string | null): void {
  if (canDeletePhoto(actor, uploadedBy)) return;
  throw new DomainError("forbidden", "Solo quien subió la foto o un administrador puede eliminarla");
}
