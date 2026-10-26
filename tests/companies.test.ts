import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EXPERT_CLEANERS_COMPANY_ID, RVA_COMPANY_ID, brandIcon, brandStyle } from "@/domain/companies";
import { todayIn } from "@/domain/date-rules";
import { isAdmin } from "@/domain/permissions";
import {
  createAppointment,
  getAppointment,
  getDay,
  getRange,
  moveAppointment,
  type Mutation,
} from "@/server/appointments";
import { createAgent, listAgents } from "@/server/agents";
import { createCustomer, deleteCustomer, getCustomer, searchCustomers } from "@/server/customers";
import { getDashboard } from "@/server/dashboard";
import { listPhotos, uploadPhoto } from "@/server/photos";
import { getAgentReport } from "@/server/reports";
import { listRouteDraftsForDay, saveRouteDraft } from "@/server/route-drafts";
import { createService, listServices, updateService } from "@/server/services";
import { createTechnician, listTechnicians } from "@/server/technicians";
import { createVehicle, listVehicles } from "@/server/vehicles";
import {
  companyBrand,
  companyOverview,
  companyPeople,
  createCompany,
  createCompanyAdmin,
  listCompanies,
  removeCompanyLogo,
  setCompanyLogo,
  updateCompany,
} from "@/server/companies";
import { companyFormFrom, companyInputFromForm, emptyCompanyForm } from "@/domain/company-form";
import sharp from "sharp";
import { getAgentReportPdf } from "@/server/reports";
import type { Technician } from "@/db/schema";
import { AGENT_JOSUE } from "@/db/seed-data";
import { appointmentInput, createTestDb } from "./helpers";
import { createMemoryStorage, jpeg } from "./photo-helpers";
import { createFakeUserAdmin } from "./user-admin-fake";
import { hexOf, pageText } from "./pdf-helpers";

vi.mock("@/server/geocoding", () => ({
  geocodeIfNeeded: async (address: unknown) => address,
  getGeocoder: () => null,
}));

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;

const EXPERT_ADMIN = {
  id: AGENT_JOSUE.id,
  name: "Admin Expert",
  role: "admin" as const,
  companyId: EXPERT_CLEANERS_COMPANY_ID,
};
const RVA_ADMIN = { id: AGENT_JOSUE.id, name: "Admin RVA", role: "admin" as const, companyId: RVA_COMPANY_ID };
const DATE = "2026-10-12";

let rvaTech: Technician;
let rvaServiceId = "";
let rvaCustomerId = "";
let rvaAddressId = "";
let expertAppointment: Mutation;
let rvaAppointment: Mutation;

beforeAll(async () => {
  ctx = await createTestDb();
  rvaTech = await createTechnician(ctx.db, RVA_ADMIN, {
    name: "Carlos Betancourt",
    color: "#c9490a",
    zone: "Orlando",
    workDays: [1, 2, 3, 4, 5, 6],
    shiftStartMin: 480,
    shiftEndMin: 1080,
  });
  const service = await createService(ctx.db, RVA_ADMIN, {
    name: "Lavado Premium",
    slug: "sofa",
    category: "Lavado",
    basePriceCents: 22000,
    durationMin: 120,
  });
  rvaServiceId = service.id;
  const created = await createCustomer(ctx.db, RVA_COMPANY_ID, {
    firstName: "Carla",
    lastName: "Gómez",
    phone: "305-555-0142",
    addresses: [{ line1: "100 N Orange Ave", unit: "", city: "Orlando", state: "FL", zip: "32801" }],
  });
  rvaCustomerId = created.customer.id;
  rvaAddressId = created.addresses[0].id;

  expertAppointment = await createAppointment(ctx.db, EXPERT_ADMIN, appointmentInput(ctx));
  rvaAppointment = await createAppointment(ctx.db, RVA_ADMIN, {
    customerId: rvaCustomerId,
    addressId: rvaAddressId,
    technicianId: rvaTech.id,
    date: DATE,
    startMin: 540,
    durationMin: 120,
    items: [{ serviceId: rvaServiceId, specs: {} }],
  });
});

afterAll(async () => {
  await ctx.client.close();
});

describe("empresas separadas", () => {
  it("vienen creadas Expert Cleaners y RVA", async () => {
    const companies = await listCompanies(ctx.db);
    expect(companies.map((company) => company.slug).sort()).toEqual(["expert-cleaners", "rva"]);
    expect(companies.find((company) => company.slug === "rva")?.settings.features.vehicles).toBe(true);
  });

  it("cada empresa lleva sus propios códigos y puede repetir identificadores de servicio", async () => {
    expect(rvaAppointment.appointment.code).toBe("SVC-2001");
    expect(expertAppointment.appointment.code).toBe("SVC-2001");
    const [rvaCustomer] = (await searchCustomers(ctx.db, RVA_COMPANY_ID, {})).items;
    expect(rvaCustomer.code).toBe("CLI-1001");
    expect(rvaCustomer.code).toBe(ctx.customer.code);
  });

  it("los listados solo muestran lo de la empresa activa", async () => {
    expect((await listTechnicians(ctx.db, RVA_COMPANY_ID)).map((tech) => tech.id)).toEqual([rvaTech.id]);
    expect((await listTechnicians(ctx.db, EXPERT_CLEANERS_COMPANY_ID)).map((tech) => tech.id)).not.toContain(
      rvaTech.id,
    );
    expect((await listServices(ctx.db, RVA_COMPANY_ID)).map((service) => service.id)).toEqual([rvaServiceId]);

    const customers = await searchCustomers(ctx.db, RVA_COMPANY_ID, { q: "305" });
    expect(customers.items.map((customer) => customer.id)).toEqual([rvaCustomerId]);
    expect(customers.total).toBe(1);

    const day = await getDay(ctx.db, RVA_COMPANY_ID, DATE);
    expect(day.appointments.map((row) => row.id)).toEqual([rvaAppointment.appointment.id]);
    const range = await getRange(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { from: DATE, to: DATE });
    expect(range.appointments.map((row) => row.id)).toEqual([expertAppointment.appointment.id]);
  });

  it("no se ve el detalle de una cita o un cliente de otra empresa", async () => {
    await expect(getAppointment(ctx.db, RVA_COMPANY_ID, expertAppointment.appointment.id)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(getCustomer(ctx.db, RVA_COMPANY_ID, ctx.customer.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(
      listPhotos(ctx.db, createMemoryStorage(), RVA_COMPANY_ID, expertAppointment.appointment.id),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("no se agenda con clientes, servicios ni técnicos de otra empresa", async () => {
    const base = {
      customerId: rvaCustomerId,
      addressId: rvaAddressId,
      technicianId: rvaTech.id,
      date: DATE,
      startMin: 900,
      durationMin: 60,
      items: [{ serviceId: rvaServiceId, specs: {} }],
    };
    await expect(
      createAppointment(ctx.db, RVA_ADMIN, { ...base, customerId: ctx.customer.id, addressId: ctx.address.id }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      createAppointment(ctx.db, RVA_ADMIN, {
        ...base,
        items: [{ serviceId: ctx.services["rug-pickup"].id, specs: {} }],
      }),
    ).rejects.toMatchObject({ code: "service_unavailable" });
    await expect(
      createAppointment(ctx.db, RVA_ADMIN, { ...base, technicianId: ctx.techs[0].id }),
    ).rejects.toMatchObject({
      code: "technician_unavailable",
    });
  });

  it("no se mueve ni se toca una cita de otra empresa", async () => {
    await expect(
      moveAppointment(ctx.db, RVA_ADMIN, expertAppointment.appointment.id, { startMin: 600, technicianId: rvaTech.id }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      moveAppointment(ctx.db, RVA_ADMIN, rvaAppointment.appointment.id, {
        startMin: 600,
        technicianId: ctx.techs[0].id,
      }),
    ).rejects.toMatchObject({ code: "technician_unavailable" });
    await expect(
      uploadPhoto(ctx.db, createMemoryStorage(), RVA_ADMIN, expertAppointment.appointment.id, jpeg()),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("un administrador no edita ni borra datos de otra empresa", async () => {
    await expect(updateService(ctx.db, RVA_ADMIN, ctx.services.sofa.id, { name: "Hackeado" })).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(
      deleteCustomer(ctx.db, RVA_ADMIN, ctx.customer.id, { confirmCode: ctx.customer.code }),
    ).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(createVehicle(ctx.db, RVA_COMPANY_ID, ctx.customer.id, { size: "suv" })).rejects.toMatchObject({
      code: "not_found",
    });
    expect(await listVehicles(ctx.db, RVA_COMPANY_ID, ctx.customer.id)).toEqual([]);
  });

  it("los agentes y los reportes quedan dentro de su empresa", async () => {
    const auth = createFakeUserAdmin();
    await createAgent(ctx.db, auth, RVA_ADMIN, { name: "Ana RVA", email: "ana@rva.test", password: "segura-123" });
    expect((await listAgents(ctx.db, auth, RVA_COMPANY_ID)).map((agent) => agent.name)).toEqual(["Ana RVA"]);
    expect((await listAgents(ctx.db, auth, EXPERT_CLEANERS_COMPANY_ID)).map((agent) => agent.name)).not.toContain(
      "Ana RVA",
    );

    const report = await getAgentReport(ctx.db, RVA_ADMIN, { period: "month", date: todayIn() });
    expect(report.totals.scheduled).toBe(1);
    expect(report.agents.map((agent) => agent.name)).not.toContain("Juancho");
  });

  it("las rutas guardadas y el inicio no se mezclan", async () => {
    const expertStops = [expertAppointment.appointment.id, `${expertAppointment.appointment.id}:entrega`];
    const draft = { date: DATE, mode: "tech" as const, groupKey: "all", stopIds: expertStops };
    await saveRouteDraft(ctx.db, EXPERT_ADMIN, draft);
    await saveRouteDraft(ctx.db, RVA_ADMIN, {
      ...draft,
      stopIds: [rvaAppointment.appointment.id, `${rvaAppointment.appointment.id}:entrega`],
    });
    expect(await listRouteDraftsForDay(ctx.db, RVA_COMPANY_ID, DATE)).toHaveLength(1);
    expect((await listRouteDraftsForDay(ctx.db, EXPERT_CLEANERS_COMPANY_ID, DATE))[0].stopIds).toEqual(expertStops);

    const dashboard = await getDashboard(ctx.db, RVA_COMPANY_ID, DATE);
    expect(dashboard.todayCount).toBe(1);
    expect(dashboard.agenda.map((row) => row.id)).toEqual([rvaAppointment.appointment.id]);
  });

  it("cada empresa trae su propia marca desde la base de datos", async () => {
    const rva = await companyBrand(ctx.db, RVA_COMPANY_ID);
    expect(rva).toMatchObject({ slug: "rva", shortName: "RVA Carwash", initials: "RVA" });
    expect(rva.location.city).toBe("Orlando");
    expect(rva.features).toEqual({ rugPickup: false, vehicles: true, publicBooking: true });
    expect(brandIcon(rva, "icon-192.png")).toBe("/clients/rva/icon-192.png");
    expect(brandStyle(rva)).toMatchObject({ "--brand": "#c9490a", "--tint": "242 106 27" });

    const expert = await companyBrand(ctx.db, EXPERT_CLEANERS_COMPANY_ID);
    expect(expert.location.city).toBe("Miami");
    expect(expert.features.rugPickup).toBe(true);
    await expect(companyBrand(ctx.db, "00000000-0000-4000-8000-0000000000ff")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("los PDF salen con el nombre y la ciudad de la empresa activa", async () => {
    const { pdf } = await getAgentReportPdf(ctx.db, RVA_ADMIN, { period: "month", date: todayIn() });
    const text = await pageText(pdf);
    expect(text).toContain(hexOf("RVA Carwash"));
    expect(text).toContain(hexOf("Orlando, FL"));
    expect(text).not.toContain(hexOf("Expert Cleaners"));
  });

  it("el dueño cuenta como administrador", () => {
    expect(isAdmin({ role: "owner" })).toBe(true);
    expect(isAdmin({ role: "agent" })).toBe(false);
  });
});

describe("administración de empresas", () => {
  const OWNER = { id: AGENT_JOSUE.id, name: "David", role: "owner" as const, companyId: EXPERT_CLEANERS_COMPANY_ID };
  const tampa = async () => ({ lat: 27.9506, lng: -82.4572 });
  const nowhere = async () => null;
  const form = (overrides = {}) =>
    companyInputFromForm({
      ...emptyCompanyForm(),
      name: "Brillo Total LLC",
      shortName: "Brillo Total",
      slug: "brillo-total",
      initials: "BT",
      city: "Tampa",
      state: "FL",
      vehicles: true,
      ...overrides,
    });

  it("solo el dueño crea, edita y ve el resumen de empresas", async () => {
    await expect(createCompany(ctx.db, RVA_ADMIN, form(), tampa)).rejects.toMatchObject({ code: "forbidden" });
    await expect(companyOverview(ctx.db, EXPERT_ADMIN)).rejects.toMatchObject({ code: "forbidden" });
    await expect(updateCompany(ctx.db, RVA_ADMIN, RVA_COMPANY_ID, form(), tampa)).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("crea una empresa ubicando la ciudad y no repite identificadores", async () => {
    const created = await createCompany(ctx.db, OWNER, form(), tampa);
    expect(created.settings.location.center).toEqual({ lat: 27.9506, lng: -82.4572 });
    expect(created.settings.features.vehicles).toBe(true);
    await expect(createCompany(ctx.db, OWNER, form({ name: "Otra" }), tampa)).rejects.toMatchObject({
      code: "slug_taken",
    });
    await expect(
      createCompany(ctx.db, OWNER, form({ slug: "sin-mapa", city: "Ciudad Inventada" }), nowhere),
    ).rejects.toMatchObject({ code: "city_not_found" });

    const overview = await companyOverview(ctx.db, OWNER);
    const rva = overview.find((company) => company.id === RVA_COMPANY_ID);
    expect(rva).toMatchObject({ technicians: 1, customers: 1, appointments: 1 });
    expect(overview.find((company) => company.id === created.id)).toMatchObject({ people: 0, appointments: 0 });
  });

  it("al editar conserva el identificador y la ubicación si la ciudad no cambió", async () => {
    const rva = (await listCompanies(ctx.db)).find((company) => company.id === RVA_COMPANY_ID)!;
    const values = companyFormFrom(rva);
    const updated = await updateCompany(
      ctx.db,
      OWNER,
      RVA_COMPANY_ID,
      companyInputFromForm({ ...values, slug: "cambiado", lat: "", lng: "", tagline: "Detailing a domicilio" }),
      nowhere,
    );
    expect(updated.slug).toBe("rva");
    expect(updated.settings.tagline).toBe("Detailing a domicilio");
    expect(updated.settings.location.center).toEqual(rva.settings.location.center);
    expect(updated.settings.theme).toEqual(rva.settings.theme);
    expect(updated.settings.logo).toEqual(rva.settings.logo);
  });

  it("procesa el logo, genera los íconos y permite quitarlo", async () => {
    const saved = new Map<string, Uint8Array>();
    const storage = {
      async put(path: string, bytes: Uint8Array) {
        saved.set(path, bytes);
        return `https://cdn.test/company-branding/${path}`;
      },
    };
    const png = new Uint8Array(
      await sharp({ create: { width: 600, height: 300, channels: 4, background: "#ff6600" } })
        .png()
        .toBuffer(),
    );
    const now = new Date("2026-10-26T12:00:00Z");
    const updated = await setCompanyLogo(ctx.db, storage, OWNER, RVA_COMPANY_ID, png, now);
    const folder = `${RVA_COMPANY_ID}/${now.getTime()}`;
    expect(updated.settings.logo).toEqual({
      src: `https://cdn.test/company-branding/${folder}/logo.webp`,
      width: 448,
      height: 224,
    });
    expect(updated.settings.icons).toBe(`https://cdn.test/company-branding/${folder}`);
    expect([...saved.keys()].sort()).toEqual(
      ["apple-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "logo.webp"].map(
        (file) => `${folder}/${file}`,
      ),
    );
    const icon = await sharp(saved.get(`${folder}/icon-512.png`)!).metadata();
    expect([icon.width, icon.height]).toEqual([512, 512]);

    await expect(
      setCompanyLogo(ctx.db, storage, OWNER, RVA_COMPANY_ID, new TextEncoder().encode("no soy imagen")),
    ).rejects.toMatchObject({ code: "invalid_logo" });

    const cleared = await removeCompanyLogo(ctx.db, OWNER, RVA_COMPANY_ID);
    expect(cleared.settings.logo).toBeNull();
    expect(cleared.settings.icons).toBe("/clients/default");
  });

  it("crea el primer administrador dentro de la empresa", async () => {
    const auth = createFakeUserAdmin();
    const brillo = (await listCompanies(ctx.db)).find((company) => company.slug === "brillo-total")!;
    const admin = await createCompanyAdmin(ctx.db, auth, OWNER, brillo.id, {
      name: "Marta Brillo",
      email: "marta@brillo.test",
      password: "segura-123",
    });
    expect(admin).toMatchObject({ role: "admin", companyId: brillo.id });
    const people = await companyPeople(ctx.db, auth, OWNER, brillo.id);
    expect(people).toEqual([
      { id: admin.id, name: "Marta Brillo", email: "marta@brillo.test", role: "admin", active: true },
    ]);
    await expect(
      createCompanyAdmin(ctx.db, auth, RVA_ADMIN, brillo.id, { name: "X", email: "x@x.test", password: "segura-123" }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(await listTechnicians(ctx.db, brillo.id)).toEqual([]);
  });
});
