import type { Actor } from "@/db/schema";
import { isAdmin, isOwner } from "@/domain/permissions";
import type { ServiceIconKey } from "@/domain/service-icons";

export const NAV_PREVIEW_SECTIONS = ["customers", "services", "agents", "technicians", "reports", "companies"] as const;

export type NavPreviewSection = (typeof NAV_PREVIEW_SECTIONS)[number];

export type NavPreview =
  | {
      section: "customers";
      total: number;
      newThisMonth: number;
      recent: { id: string; code: string; name: string; phone: string }[];
    }
  | {
      section: "services";
      active: number;
      inactive: number;
      items: { id: string; name: string; icon: ServiceIconKey; durationMin: number; priceCents: number }[];
    }
  | {
      section: "agents";
      items: { id: string; name: string; role: Actor["role"]; active: boolean }[];
    }
  | {
      section: "technicians";
      items: { id: string; name: string; color: string; zone: string; active: boolean; today: number }[];
    }
  | {
      section: "reports";
      from: string;
      to: string;
      scheduled: number;
      completed: number;
      cancelled: number;
      bookedCents: number;
      paidCents: number;
      unpaidCents: number;
      top: { id: string; name: string; scheduled: number; bookedCents: number }[];
    }
  | {
      section: "companies";
      currentId: string;
      items: { id: string; name: string; label: string; active: boolean }[];
    };

export function isNavPreviewSection(value: unknown): value is NavPreviewSection {
  return typeof value === "string" && (NAV_PREVIEW_SECTIONS as readonly string[]).includes(value);
}

export function canPreview(actor: Pick<Actor, "role">, section: NavPreviewSection): boolean {
  if (section === "companies") return isOwner(actor);
  if (section === "services" || section === "agents" || section === "technicians") return isAdmin(actor);
  return true;
}
