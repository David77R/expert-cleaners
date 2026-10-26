import { z, type ZodError } from "zod";
import { minutesToTimeInput, parseTimeInput } from "./appointment-panel";
import type { BusinessHours, CompanySettings } from "./companies";
import { STATE_NAMES } from "./us-states";

export const DEFAULT_BRAND_COLOR = "#0d9c8e";
export const DEFAULT_RAIL_COLOR = "#12181f";
export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;
export const SLUG_RULE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const HEX = /^#[0-9a-f]{6}$/i;

export const COMPANY_TEXT_FIELDS = [
  "name",
  "shortName",
  "slug",
  "initials",
  "tagline",
  "headline",
  "city",
  "state",
  "radiusKm",
  "lat",
  "lng",
  "brandColor",
  "railColor",
  "locale",
  "slotMinutes",
  "minNoticeHours",
  "maxDaysAhead",
  "phone",
  "email",
] as const;

export type CompanyTextField = (typeof COMPANY_TEXT_FIELDS)[number];
export type DayHours = { open: boolean; start: string; end: string };
export type CompanyFormValues = Record<CompanyTextField, string> & {
  rugPickup: boolean;
  vehicles: boolean;
  publicBooking: boolean;
  active: boolean;
  hours: Record<number, DayHours>;
};
export type CompanyFormField = CompanyTextField | "hours";
export type CompanyFormErrors = Partial<Record<CompanyFormField, string>>;

function channel(hex: string, index: number): number {
  return parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
}

export function mixColor(from: string, to: string, amount: number): string {
  const part = (index: number) =>
    Math.round(channel(from, index) * (1 - amount) + channel(to, index) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${part(0)}${part(1)}${part(2)}`;
}

export function rgbTriplet(hex: string): string {
  return `${channel(hex, 0)} ${channel(hex, 1)} ${channel(hex, 2)}`;
}

export function themeFromColors(brand: string, rail: string): Record<string, string> {
  return {
    "--brand": brand,
    "--brand-soft": mixColor(brand, "#ffffff", 0.88),
    "--brand-ink": mixColor(brand, "#000000", 0.3),
    "--canvas": mixColor(rail, "#ffffff", 0.94),
    "--hair": mixColor(rail, "#ffffff", 0.86),
    "--rail": rail,
    "--rail-raised": mixColor(rail, "#ffffff", 0.06),
    "--rail-line": mixColor(rail, "#ffffff", 0.12),
    "--rail-text": mixColor(rail, "#ffffff", 0.62),
  };
}

export function serviceBox(lat: number, lng: number, radiusKm: number): string {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const round = (value: number) => Math.round(value * 10) / 10;
  return [round(lng - dLng), round(lat - dLat), round(lng + dLng), round(lat + dLat)].join(",");
}

function defaultHours(): Record<number, DayHours> {
  return Object.fromEntries(
    WEEK_DAYS.map((day) => [
      day,
      day === 0
        ? { open: false, start: "08:00", end: "18:00" }
        : day === 6
          ? { open: true, start: "09:00", end: "17:00" }
          : { open: true, start: "08:00", end: "18:00" },
    ]),
  );
}

export function emptyCompanyForm(): CompanyFormValues {
  return {
    name: "",
    shortName: "",
    slug: "",
    initials: "",
    tagline: "Centro de operaciones",
    headline: "",
    city: "",
    state: "FL",
    radiusKm: "100",
    lat: "",
    lng: "",
    brandColor: DEFAULT_BRAND_COLOR,
    railColor: DEFAULT_RAIL_COLOR,
    locale: "es",
    slotMinutes: "60",
    minNoticeHours: "12",
    maxDaysAhead: "30",
    phone: "",
    email: "",
    rugPickup: false,
    vehicles: false,
    publicBooking: false,
    active: true,
    hours: defaultHours(),
  };
}

export function companyFormFrom(company: {
  name: string;
  slug: string;
  active: boolean;
  settings: CompanySettings;
}): CompanyFormValues {
  const { settings } = company;
  const hours = Object.fromEntries(
    WEEK_DAYS.map((day) => {
      const range = settings.booking.hours[day];
      return [
        day,
        range
          ? { open: true, start: minutesToTimeInput(range[0]), end: minutesToTimeInput(range[1]) }
          : { open: false, start: "08:00", end: "18:00" },
      ];
    }),
  );
  return {
    name: company.name,
    shortName: settings.shortName,
    slug: company.slug,
    initials: settings.initials,
    tagline: settings.tagline,
    headline: settings.headline,
    city: settings.location.city,
    state: settings.location.state,
    radiusKm: String(settings.location.radiusKm),
    lat: String(settings.location.center.lat),
    lng: String(settings.location.center.lng),
    brandColor: settings.theme["--brand"] ?? DEFAULT_BRAND_COLOR,
    railColor: settings.theme["--rail"] ?? DEFAULT_RAIL_COLOR,
    locale: settings.booking.locale,
    slotMinutes: String(settings.booking.slotMinutes),
    minNoticeHours: String(settings.booking.minNoticeHours),
    maxDaysAhead: String(settings.booking.maxDaysAhead),
    phone: settings.contact.phone,
    email: settings.contact.email,
    rugPickup: settings.features.rugPickup,
    vehicles: settings.features.vehicles,
    publicBooking: settings.features.publicBooking,
    active: company.active,
    hours,
  };
}

export function readCompanyForm(data: { get(name: string): FormDataEntryValue | null }): CompanyFormValues {
  const text = (name: string) => {
    const entry = data.get(name);
    return typeof entry === "string" ? entry : "";
  };
  const values = emptyCompanyForm();
  for (const field of COMPANY_TEXT_FIELDS) values[field] = text(field);
  values.rugPickup = data.get("rugPickup") === "on";
  values.vehicles = data.get("vehicles") === "on";
  values.publicBooking = data.get("publicBooking") === "on";
  values.active = data.get("active") === "on";
  values.hours = Object.fromEntries(
    WEEK_DAYS.map((day) => [
      day,
      { open: data.get(`open_${day}`) === "on", start: text(`start_${day}`), end: text(`end_${day}`) },
    ]),
  );
  return values;
}

const number = (min: number, max: number, message: string) =>
  z.coerce.number({ error: message }).int(message).min(min, message).max(max, message);

const coordinate = (limit: number) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || Math.abs(parsed) > limit) {
        ctx.addIssue({ code: "custom", message: "Coordenada no válida" });
        return z.NEVER;
      }
      return parsed;
    });

export const companyInputSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre de la empresa").max(80),
  shortName: z.string().trim().min(2, "Escribe un nombre corto").max(30),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_RULE, "Usa solo letras minúsculas, números y guiones")
    .min(2)
    .max(40),
  initials: z.string().trim().min(1, "Escribe las iniciales").max(4, "Máximo 4 letras").toUpperCase(),
  tagline: z.string().trim().max(60),
  headline: z.string().trim().max(140),
  city: z.string().trim().min(2, "Escribe la ciudad").max(60),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value in STATE_NAMES, "Escribe un estado válido, por ejemplo FL"),
  radiusKm: number(10, 500, "Escribe un radio entre 10 y 500 km"),
  lat: coordinate(90),
  lng: coordinate(180),
  brandColor: z.string().regex(HEX, "Elige un color válido"),
  railColor: z.string().regex(HEX, "Elige un color válido"),
  locale: z.enum(["es", "en"]),
  slotMinutes: number(15, 240, "Escribe entre 15 y 240 minutos"),
  minNoticeHours: number(0, 168, "Escribe entre 0 y 168 horas"),
  maxDaysAhead: number(1, 180, "Escribe entre 1 y 180 días"),
  phone: z.string().trim().max(30),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .refine((value) => value === "" || z.email().safeParse(value).success, "Escribe un correo válido"),
  rugPickup: z.boolean(),
  vehicles: z.boolean(),
  publicBooking: z.boolean(),
  active: z.boolean(),
  hours: z.record(z.string(), z.tuple([z.number(), z.number()]).nullable()),
});

export type CompanyInput = z.output<typeof companyInputSchema>;

export function hoursFromForm(hours: Record<number, DayHours>): { hours: BusinessHours; error?: string } {
  const result: BusinessHours = {};
  for (const day of WEEK_DAYS) {
    const entry = hours[day];
    if (!entry?.open) {
      result[day] = null;
      continue;
    }
    const start = parseTimeInput(entry.start);
    const end = parseTimeInput(entry.end);
    if (start === null || end === null || end <= start) {
      return {
        hours: result,
        error: "Revisa el horario: cada día abierto necesita una hora de cierre después de la apertura",
      };
    }
    result[day] = [start, end];
  }
  if (Object.values(result).every((range) => range === null)) {
    return { hours: result, error: "Abre al menos un día de la semana" };
  }
  return { hours: result };
}

export function companyInputFromForm(values: CompanyFormValues) {
  const { hours } = hoursFromForm(values.hours);
  return { ...values, hours };
}

export function validateCompanyForm(values: CompanyFormValues): CompanyFormErrors {
  const errors: CompanyFormErrors = {};
  const parsed = companyInputSchema.safeParse(companyInputFromForm(values));
  if (!parsed.success) Object.assign(errors, companyFieldErrors(parsed.error));
  const { error } = hoursFromForm(values.hours);
  if (error) errors.hours = error;
  if ((values.lat.trim() === "") !== (values.lng.trim() === "")) {
    errors.lat = "Escribe latitud y longitud, o deja las dos vacías";
  }
  return errors;
}

export function companyFieldErrors(error: ZodError): CompanyFormErrors {
  const errors: CompanyFormErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string" || key in errors) continue;
    if ((COMPANY_TEXT_FIELDS as readonly string[]).includes(key)) errors[key as CompanyTextField] = issue.message;
    else if (key === "hours") errors.hours = issue.message;
  }
  return errors;
}

export function settingsFromInput(
  input: CompanyInput,
  center: { lat: number; lng: number },
  previous: CompanySettings | null,
): CompanySettings {
  const previousBrand = previous?.theme["--brand"] ?? DEFAULT_BRAND_COLOR;
  const previousRail = previous?.theme["--rail"] ?? DEFAULT_RAIL_COLOR;
  const colorsChanged =
    previous === null ||
    input.brandColor.toLowerCase() !== previousBrand.toLowerCase() ||
    input.railColor.toLowerCase() !== previousRail.toLowerCase();
  const theme = colorsChanged ? themeFromColors(input.brandColor, input.railColor) : previous.theme;
  return {
    shortName: input.shortName,
    initials: input.initials,
    tagline: input.tagline,
    headline: input.headline || `Cada cita, cada ruta y cada técnico de ${input.shortName} en un solo tablero.`,
    logo: previous?.logo ?? null,
    ...(previous?.icons ? { icons: previous.icons } : previous ? {} : { icons: "/clients/default" }),
    location: {
      label: `${input.city}, ${input.state}`,
      city: input.city,
      state: input.state,
      stateName: STATE_NAMES[input.state] ?? input.state,
      center,
      radiusKm: input.radiusKm,
      bbox: serviceBox(center.lat, center.lng, input.radiusKm),
    },
    theme,
    themeColor: colorsChanged ? input.railColor : (previous?.themeColor ?? input.railColor),
    backgroundTint: colorsChanged
      ? rgbTriplet(input.brandColor)
      : (previous?.backgroundTint ?? rgbTriplet(input.brandColor)),
    features: { rugPickup: input.rugPickup, vehicles: input.vehicles, publicBooking: input.publicBooking },
    booking: {
      locale: input.locale,
      hours: input.hours as BusinessHours,
      slotMinutes: input.slotMinutes,
      minNoticeHours: input.minNoticeHours,
      maxDaysAhead: input.maxDaysAhead,
    },
    contact: { phone: input.phone, email: input.email },
  };
}
