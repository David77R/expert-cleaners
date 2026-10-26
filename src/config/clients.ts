export type ClientId = "expert-cleaners" | "rva";

export type BusinessHours = Record<number, readonly [number, number] | null>;

export type ClientConfig = {
  id: ClientId;
  name: string;
  shortName: string;
  initials: string;
  tagline: string;
  headline: string;
  logo: { src: string; width: number; height: number } | null;
  location: {
    label: string;
    city: string;
    state: string;
    stateName: string;
    center: { lat: number; lng: number };
    radiusKm: number;
    bbox: string;
  };
  theme: Record<string, string>;
  themeColor: string;
  backgroundTint: string;
  features: { rugPickup: boolean; vehicles: boolean; publicBooking: boolean };
  booking: {
    locale: "es" | "en";
    hours: BusinessHours;
    slotMinutes: number;
    minNoticeHours: number;
    maxDaysAhead: number;
  };
  contact: { phone: string; email: string };
};

const MIAMI = {
  label: "Miami, FL",
  city: "Miami",
  state: "FL",
  stateName: "Florida",
  center: { lat: 25.7617, lng: -80.1918 },
  radiusKm: 200,
  bbox: "-81.9,24.4,-79.9,27.3",
};

const ORLANDO = {
  label: "Orlando, FL",
  city: "Orlando",
  state: "FL",
  stateName: "Florida",
  center: { lat: 28.5383, lng: -81.3792 },
  radiusKm: 160,
  bbox: "-82.9,27.3,-80.2,29.7",
};

const WEEKDAYS_8_TO_6: BusinessHours = {
  0: null,
  1: [480, 1080],
  2: [480, 1080],
  3: [480, 1080],
  4: [480, 1080],
  5: [480, 1080],
  6: [540, 1020],
};

export const CLIENTS: Record<ClientId, ClientConfig> = {
  "expert-cleaners": {
    id: "expert-cleaners",
    name: "Expert Cleaners",
    shortName: "Expert Cleaners",
    initials: "EC",
    tagline: "Centro de operaciones",
    headline: "Cada técnico, cada cita, cada hora del día en un solo tablero.",
    logo: null,
    location: MIAMI,
    theme: {},
    themeColor: "#12181f",
    backgroundTint: "13 156 142",
    features: { rugPickup: true, vehicles: false, publicBooking: false },
    booking: { locale: "es", hours: WEEKDAYS_8_TO_6, slotMinutes: 60, minNoticeHours: 12, maxDaysAhead: 30 },
    contact: { phone: "", email: "" },
  },
  rva: {
    id: "rva",
    name: "RVA Mobile Carwash & Detailing",
    shortName: "RVA Carwash",
    initials: "RVA",
    tagline: "Centro de operaciones",
    headline: "Cada lavado, cada ruta y cada técnico en un solo tablero.",
    logo: { src: "/clients/rva/logo.webp", width: 300, height: 208 },
    location: ORLANDO,
    theme: {
      "--brand": "#c9490a",
      "--brand-soft": "#fdeee4",
      "--brand-ink": "#9a3a07",
      "--canvas": "#f1f1f2",
      "--hair": "#dcdce0",
      "--rail": "#131316",
      "--rail-raised": "#1e1e23",
      "--rail-line": "#2c2c33",
      "--rail-text": "#a5a6ad",
    },
    themeColor: "#131316",
    backgroundTint: "242 106 27",
    features: { rugPickup: false, vehicles: true, publicBooking: true },
    booking: { locale: "en", hours: WEEKDAYS_8_TO_6, slotMinutes: 60, minNoticeHours: 12, maxDaysAhead: 30 },
    contact: { phone: "", email: "" },
  },
};

export function clientIdFrom(raw: string | undefined): ClientId {
  return raw && raw in CLIENTS ? (raw as ClientId) : "expert-cleaners";
}

export const client: ClientConfig = CLIENTS[clientIdFrom(process.env.NEXT_PUBLIC_CLIENT_ID)];

export function iconPath(file: string): string {
  return `/clients/${client.id}/${file}`;
}
