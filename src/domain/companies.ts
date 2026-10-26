import type { CSSProperties } from "react";

export type BusinessHours = Record<number, readonly [number, number] | null>;

export type CompanyLocation = {
  label: string;
  city: string;
  state: string;
  stateName: string;
  center: { lat: number; lng: number };
  radiusKm: number;
  bbox: string;
};

export type CompanyFeatures = { rugPickup: boolean; vehicles: boolean; publicBooking: boolean };

export type CompanySettings = {
  shortName: string;
  initials: string;
  tagline: string;
  headline: string;
  logo: { src: string; width: number; height: number } | null;
  location: CompanyLocation;
  theme: Record<string, string>;
  themeColor: string;
  backgroundTint: string;
  features: CompanyFeatures;
  booking: {
    locale: "es" | "en";
    hours: BusinessHours;
    slotMinutes: number;
    minNoticeHours: number;
    maxDaysAhead: number;
  };
  contact: { phone: string; email: string };
};

export type Brand = CompanySettings & { id: string; slug: string; name: string };

export const EXPERT_CLEANERS_COMPANY_ID = "00000000-0000-4000-8000-00000000c001";
export const RVA_COMPANY_ID = "00000000-0000-4000-8000-00000000c002";
export const DEFAULT_COMPANY_SLUG = "expert-cleaners";

export const ACTIVE_COMPANY_COOKIE = "cc-company";

export function brandOf(company: { id: string; slug: string; name: string; settings: CompanySettings }): Brand {
  return { ...company.settings, id: company.id, slug: company.slug, name: company.name };
}

export function brandIcon(brand: Pick<Brand, "slug">, file: string): string {
  return `/clients/${brand.slug}/${file}`;
}

export function brandStyle(brand: Pick<Brand, "theme" | "backgroundTint">): CSSProperties {
  return { ...brand.theme, "--tint": brand.backgroundTint } as CSSProperties;
}
