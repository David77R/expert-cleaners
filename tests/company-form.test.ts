import { describe, expect, it } from "vitest";
import {
  companyFormFrom,
  companyInputFromForm,
  companyInputSchema,
  emptyCompanyForm,
  hoursFromForm,
  mixColor,
  readCompanyForm,
  rgbTriplet,
  serviceBox,
  settingsFromInput,
  themeFromColors,
  validateCompanyForm,
  type CompanyFormValues,
} from "@/domain/company-form";
import { brandIcon } from "@/domain/companies";
import { RVA_BRAND } from "./brands";

function filled(overrides: Partial<CompanyFormValues> = {}): CompanyFormValues {
  return {
    ...emptyCompanyForm(),
    name: "Brillo Total LLC",
    shortName: "Brillo Total",
    slug: "brillo-total",
    initials: "bt",
    city: "Tampa",
    state: "fl",
    lat: "27.95",
    lng: "-82.46",
    ...overrides,
  };
}

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

describe("colores de la empresa", () => {
  it("mezcla colores y arma la paleta completa a partir de dos colores", () => {
    expect(mixColor("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(rgbTriplet("#c9490a")).toBe("201 73 10");
    const theme = themeFromColors("#c9490a", "#131316");
    expect(theme["--brand"]).toBe("#c9490a");
    expect(theme["--rail"]).toBe("#131316");
    expect(Object.keys(theme)).toEqual([
      "--brand",
      "--brand-soft",
      "--brand-ink",
      "--canvas",
      "--hair",
      "--rail",
      "--rail-raised",
      "--rail-line",
      "--rail-text",
    ]);
    expect(theme["--brand-soft"]).toMatch(/^#f[0-9a-f]{5}$/);
  });

  it("calcula una caja de búsqueda alrededor de la ciudad", () => {
    const [west, south, east, north] = serviceBox(28.54, -81.38, 160).split(",").map(Number);
    expect(south).toBeLessThan(28.54);
    expect(north).toBeGreaterThan(28.54);
    expect(west).toBeLessThan(-81.38);
    expect(east).toBeGreaterThan(-81.38);
  });
});

describe("horario de atención", () => {
  it("convierte los días abiertos y deja cerrados los demás", () => {
    const { hours, error } = hoursFromForm(emptyCompanyForm().hours);
    expect(error).toBeUndefined();
    expect(hours[1]).toEqual([480, 1080]);
    expect(hours[6]).toEqual([540, 1020]);
    expect(hours[0]).toBeNull();
  });

  it("pide que cierre después de abrir y al menos un día abierto", () => {
    const backwards = { ...emptyCompanyForm().hours, 1: { open: true, start: "18:00", end: "08:00" } };
    expect(hoursFromForm(backwards).error).toMatch(/hora de cierre/);
    const closed = Object.fromEntries(
      Object.entries(emptyCompanyForm().hours).map(([day, value]) => [day, { ...value, open: false }]),
    );
    expect(hoursFromForm(closed).error).toMatch(/al menos un día/);
  });
});

describe("formulario de empresa", () => {
  it("lee el formulario con funciones y horario", () => {
    const values = readCompanyForm(
      formData({ name: "X", vehicles: "on", open_1: "on", start_1: "07:30", end_1: "16:00", active: "on" }),
    );
    expect(values.vehicles).toBe(true);
    expect(values.rugPickup).toBe(false);
    expect(values.active).toBe(true);
    expect(values.hours[1]).toEqual({ open: true, start: "07:30", end: "16:00" });
    expect(values.hours[2].open).toBe(false);
  });

  it("valida nombre, identificador, estado y coordenadas", () => {
    expect(validateCompanyForm(filled())).toEqual({});
    const errors = validateCompanyForm(filled({ name: "", slug: "Mi Empresa", state: "ZZ", lat: "27", lng: "" }));
    expect(Object.keys(errors).sort()).toEqual(["lat", "name", "slug", "state"]);
  });

  it("normaliza iniciales y estado y deja las coordenadas vacías como nulas", () => {
    const input = companyInputSchema.parse(companyInputFromForm(filled({ lat: "", lng: "" })));
    expect(input.initials).toBe("BT");
    expect(input.state).toBe("FL");
    expect(input.lat).toBeNull();
  });

  it("arma la configuración de una empresa nueva con ícono genérico", () => {
    const input = companyInputSchema.parse(companyInputFromForm(filled({ brandColor: "#2255aa", vehicles: true })));
    const settings = settingsFromInput(input, { lat: 27.95, lng: -82.46 }, null);
    expect(settings.location).toMatchObject({ label: "Tampa, FL", stateName: "Florida", radiusKm: 100 });
    expect(settings.theme["--brand"]).toBe("#2255aa");
    expect(settings.backgroundTint).toBe("34 85 170");
    expect(settings.features.vehicles).toBe(true);
    expect(settings.logo).toBeNull();
    expect(brandIcon({ slug: "brillo-total", icons: settings.icons }, "icon-192.png")).toBe(
      "/clients/default/icon-192.png",
    );
    expect(settings.headline).toContain("Brillo Total");
  });

  it("al editar sin cambiar colores conserva la paleta, el logo y los íconos", () => {
    const values = companyFormFrom({ name: RVA_BRAND.name, slug: RVA_BRAND.slug, active: true, settings: RVA_BRAND });
    expect(values.brandColor).toBe("#c9490a");
    expect(values.vehicles).toBe(true);
    const input = companyInputSchema.parse(companyInputFromForm({ ...values, tagline: "Nuevo lema" }));
    const settings = settingsFromInput(input, RVA_BRAND.location.center, RVA_BRAND);
    expect(settings.theme).toBe(RVA_BRAND.theme);
    expect(settings.logo).toEqual(RVA_BRAND.logo);
    expect(settings.tagline).toBe("Nuevo lema");
    expect(settings.icons).toBeUndefined();

    const recolored = settingsFromInput({ ...input, brandColor: "#123456" }, RVA_BRAND.location.center, RVA_BRAND);
    expect(recolored.theme["--brand"]).toBe("#123456");
    expect(recolored.themeColor).toBe(input.railColor);
  });
});
