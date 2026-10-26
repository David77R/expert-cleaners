import { EXPERT_CLEANERS_COMPANY_ID, RVA_COMPANY_ID, type Brand, type BusinessHours } from "@/domain/companies";

const HOURS: BusinessHours = {
  0: null,
  1: [480, 1080],
  2: [480, 1080],
  3: [480, 1080],
  4: [480, 1080],
  5: [480, 1080],
  6: [540, 1020],
};

export const EXPERT_BRAND: Brand = {
  id: EXPERT_CLEANERS_COMPANY_ID,
  slug: "expert-cleaners",
  name: "Expert Cleaners",
  shortName: "Expert Cleaners",
  initials: "EC",
  tagline: "Centro de operaciones",
  headline: "Cada técnico, cada cita, cada hora del día en un solo tablero.",
  logo: null,
  location: {
    label: "Miami, FL",
    city: "Miami",
    state: "FL",
    stateName: "Florida",
    center: { lat: 25.7617, lng: -80.1918 },
    radiusKm: 200,
    bbox: "-81.9,24.4,-79.9,27.3",
  },
  theme: {},
  themeColor: "#12181f",
  backgroundTint: "13 156 142",
  features: { rugPickup: true, vehicles: false, publicBooking: false },
  booking: { locale: "es", hours: HOURS, slotMinutes: 60, minNoticeHours: 12, maxDaysAhead: 30 },
  contact: { phone: "", email: "" },
};

export const RVA_BRAND: Brand = {
  ...EXPERT_BRAND,
  id: RVA_COMPANY_ID,
  slug: "rva",
  name: "RVA Mobile Carwash & Detailing",
  shortName: "RVA Carwash",
  initials: "RVA",
  logo: { src: "/clients/rva/logo.webp", width: 300, height: 208 },
  location: {
    label: "Orlando, FL",
    city: "Orlando",
    state: "FL",
    stateName: "Florida",
    center: { lat: 28.5383, lng: -81.3792 },
    radiusKm: 160,
    bbox: "-82.9,27.3,-80.2,29.7",
  },
  theme: { "--brand": "#c9490a", "--brand-soft": "#fdeee4" },
  features: { rugPickup: false, vehicles: true, publicBooking: true },
  booking: { ...EXPERT_BRAND.booking, locale: "en" },
};

export const MIAMI = EXPERT_BRAND.location;
