import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EXPERT_CLEANERS_COMPANY_ID } from "@/domain/companies";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import { addresses as addressesTable, appointmentPhotos as appointmentPhotosTable } from "@/db/schema";
import { AGENT_JOSUE } from "@/db/seed-data";
import { DomainError } from "@/domain/appointment-rules";
import { escapeLike, isValidPhone, phoneDigits } from "@/domain/customer-rules";
import { createAppointment, getAppointment } from "@/server/appointments";
import {
  addAddress,
  addCustomerNote,
  createCustomer,
  deleteAddress,
  deleteCustomer,
  findCustomerByCode,
  getCustomer,
  mergeCustomers,
  possibleDuplicates,
  relocateAddress,
  locateMissingAddresses,
  searchCustomers,
  updateAddress,
  updateCustomer,
} from "@/server/customers";
import { appointmentInput, createTestDb } from "./helpers";

vi.mock("@/server/geocoding", () => ({
  geocodeIfNeeded: async <T extends { city: string; lat?: number | null; lng?: number | null }>(address: T) => {
    if (address.lat != null && address.lng != null) return address;
    const known: Record<string, [number, number]> = { Miami: [25.77, -80.19], Hialeah: [25.86, -80.28] };
    const coords = known[address.city];
    return coords ? { ...address, lat: coords[0], lng: coords[1] } : address;
  },
}));

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.client.close();
});

const home = { line1: "500 Biscayne Blvd", unit: "", city: "Miami", state: "FL", zip: "33132" };
const office = { line1: "8000 NW 36th St", unit: "Suite 2", city: "Doral", state: "FL", zip: "33166" };

function newCustomer(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Laura",
    lastName: "Pérez",
    phone: "(305) 555-0142",
    addresses: [home],
    ...overrides,
  };
}

describe("reglas de teléfono", () => {
  it("extrae solo dígitos", () => {
    expect(phoneDigits("+1 (305) 555-0142")).toBe("13055550142");
  });

  it("acepta entre 7 y 15 dígitos", () => {
    expect(isValidPhone("555-0142")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("1234567890123456")).toBe(false);
  });

  it("escapa los comodines de LIKE", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("crear cliente", () => {
  it("genera código CLI consecutivo y guarda sus direcciones", async () => {
    const first = await createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, newCustomer({ phone: "786 555 0100" }));
    const second = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ firstName: "Mario", phone: "786 555 0101" }),
    );
    expect(first.customer.code).toMatch(/^CLI-\d+$/);
    expect(Number(second.customer.code.slice(4))).toBe(Number(first.customer.code.slice(4)) + 1);
    expect(first.addresses).toHaveLength(1);
    expect(first.addresses[0].customerId).toBe(first.customer.id);
  });

  it("el primer cliente nuevo continúa después del cliente semilla", async () => {
    const created = await createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, newCustomer({ phone: "786 555 0102" }));
    expect(Number(created.customer.code.slice(4))).toBeGreaterThan(1001);
  });

  it("normaliza el correo a minúsculas", async () => {
    const { customer } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ phone: "786 555 0103", email: "  Laura@Example.COM " }),
    );
    expect(customer.email).toBe("laura@example.com");
  });

  it("avisa de teléfonos duplicados sin bloquear la creación", async () => {
    await createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, newCustomer({ phone: "954-555-0200" }));
    const second = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ firstName: "Otra", phone: "(954) 555 0200" }),
    );
    expect(second.customer.id).toBeDefined();
    expect(second.duplicates).toHaveLength(1);
    expect(second.duplicates[0].lastName).toBe("Pérez");
  });

  it("exige al menos una dirección y un teléfono válido", async () => {
    await expect(
      createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, newCustomer({ addresses: [] })),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, newCustomer({ phone: "123" })),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, newCustomer({ email: "no-es-correo" })),
    ).rejects.toBeInstanceOf(ZodError);
  });
});

describe("actualizar cliente", () => {
  it("cambia solo los campos enviados", async () => {
    const { customer } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ phone: "786 555 0300", notes: "Llamar antes" }),
    );
    const result = await updateCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id, { lastName: "Gómez" });
    expect(result.customer.lastName).toBe("Gómez");
    expect(result.customer.firstName).toBe("Laura");
    expect(result.customer.notes).toBe("Llamar antes");
  });

  it("permite limpiar correo y notas con null", async () => {
    const { customer } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ phone: "786 555 0301", email: "a@b.com", notes: "x" }),
    );
    const result = await updateCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id, { email: null, notes: null });
    expect(result.customer.email).toBeNull();
    expect(result.customer.notes).toBeNull();
  });

  it("avisa de duplicado solo cuando el teléfono cambia a uno existente", async () => {
    const a = await createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, newCustomer({ phone: "786 555 0400" }));
    const b = await createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, newCustomer({ phone: "786 555 0401" }));
    const unchanged = await updateCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, b.customer.id, { firstName: "Nuevo" });
    expect(unchanged.duplicates).toEqual([]);
    const clash = await updateCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, b.customer.id, { phone: "786-555-0400" });
    expect(clash.duplicates.map((d) => d.id)).toEqual([a.customer.id]);
  });

  it("rechaza un cuerpo vacío y clientes inexistentes", async () => {
    await expect(updateCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, ctx.customer.id, {})).rejects.toBeInstanceOf(
      ZodError,
    );
    await expect(
      updateCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, "00000000-0000-4000-8000-0000000000ff", { firstName: "X" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("buscar clientes", () => {
  beforeAll(async () => {
    await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ firstName: "Zulay", lastName: "Quintero", phone: "305-555-7788" }),
    );
    await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ firstName: "Zacarías", lastName: "Pino", phone: "305-555-7799", email: "zaca@correo.com" }),
    );
  });

  it("encuentra por nombre completo sin importar mayúsculas", async () => {
    const { items } = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "zulay quin" });
    expect(items).toHaveLength(1);
    expect(items[0].lastName).toBe("Quintero");
  });

  it("encuentra por teléfono ignorando el formato", async () => {
    const { items } = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "(305) 555 7799" });
    expect(items.map((c) => c.firstName)).toEqual(["Zacarías"]);
  });

  it("encuentra por correo y por código", async () => {
    const byEmail = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "zaca@correo" });
    expect(byEmail.items).toHaveLength(1);
    const byCode = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: ctx.customer.code });
    expect(byCode.items.map((c) => c.id)).toContain(ctx.customer.id);
  });

  it("trata % y _ como texto literal", async () => {
    const { items } = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "%" });
    expect(items).toEqual([]);
  });

  it("incluye las direcciones y pagina con hasMore", async () => {
    const page = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.items[0].addresses.length).toBeGreaterThan(0);
    const next = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { limit: 2, offset: 2 });
    expect(next.items[0].id).not.toBe(page.items[0].id);
  });

  it("ordena por apellido y luego por nombre", async () => {
    const base = { phone: "305-555-9000", addresses: [home] };
    await createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, {
      ...base,
      firstName: "Beto",
      lastName: "Aguirre",
      email: "orden-1@correo.com",
    });
    await createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, {
      ...base,
      firstName: "Ana",
      lastName: "Zambrano",
      email: "orden-2@correo.com",
    });
    await createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, {
      ...base,
      firstName: "Ana",
      lastName: "Aguirre",
      email: "orden-3@correo.com",
    });
    const { items } = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "orden-" });
    expect(items.map((c) => `${c.lastName} ${c.firstName}`)).toEqual(["Aguirre Ana", "Aguirre Beto", "Zambrano Ana"]);
  });

  it("acepta parámetros de query string como texto", async () => {
    const { items } = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, {
      q: "Quintero",
      limit: "5",
      offset: "0",
    });
    expect(items).toHaveLength(1);
  });
});

describe("detalle de cliente", () => {
  it("conserva las notas generales del cliente junto al historial de notas", async () => {
    const { customer } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ phone: "786 555 0499", notes: "Portón azul" }),
    );
    await addCustomerNote(ctx.db, AGENT_JOSUE, customer.id, { text: "Nota firmada" });

    const detail = await getCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id);
    expect(detail.notes).toBe("Portón azul");
    expect(detail.history).toHaveLength(1);
    expect(detail.history[0].text).toBe("Nota firmada");
  });

  it("devuelve direcciones, notas recientes primero y citas", async () => {
    await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-02" }));
    await addCustomerNote(ctx.db, AGENT_JOSUE, ctx.customer.id, { text: "Primera nota" });
    await addCustomerNote(ctx.db, AGENT_JOSUE, ctx.customer.id, { text: "Segunda nota" });

    const detail = await getCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, ctx.customer.id);
    expect(detail.addresses.length).toBeGreaterThan(0);
    expect(detail.history[0].text).toBe("Segunda nota");
    expect(detail.history[0].authorName).toBe(AGENT_JOSUE.name);
    expect(detail.appointments.length).toBeGreaterThan(0);
    expect(detail.appointments[0].service.name).toBeDefined();
    expect(detail.appointments[0].agent.name).toBe(AGENT_JOSUE.name);
  });

  it("falla con not_found si no existe", async () => {
    await expect(
      getCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, "00000000-0000-4000-8000-0000000000ff"),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("direcciones", () => {
  it("agrega y actualiza sin tocar los campos no enviados", async () => {
    const { customer } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ phone: "786 555 0500" }),
    );
    const added = await addAddress(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id, office);
    expect(added.unit).toBe("Suite 2");

    const updated = await updateAddress(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id, added.id, { city: "Hialeah" });
    expect(updated.city).toBe("Hialeah");
    expect(updated.unit).toBe("Suite 2");
    expect(updated.line1).toBe(office.line1);
  });

  it("no actualiza una dirección de otro cliente", async () => {
    const { customer } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ phone: "786 555 0501" }),
    );
    await expect(
      updateAddress(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id, ctx.address.id, { city: "X" }),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("elimina una dirección libre cuando quedan otras", async () => {
    const { customer } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ phone: "786 555 0502" }),
    );
    const added = await addAddress(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id, office);
    await deleteAddress(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id, added.id);
    const detail = await getCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id);
    expect(detail.addresses).toHaveLength(1);
  });

  it("no elimina la última dirección", async () => {
    const { customer, addresses } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ phone: "786 555 0503" }),
    );
    await expect(deleteAddress(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id, addresses[0].id)).rejects.toMatchObject(
      {
        code: "last_address",
      },
    );
  });

  it("no elimina una dirección con citas asociadas", async () => {
    const extra = await addAddress(ctx.db, EXPERT_CLEANERS_COMPANY_ID, ctx.customer.id, office);
    await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { addressId: extra.id, date: "2026-11-03" }));
    const error = await deleteAddress(ctx.db, EXPERT_CLEANERS_COMPANY_ID, ctx.customer.id, extra.id).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ code: "address_in_use" });
  });
});

describe("notas de cliente", () => {
  it("rechaza notas vacías y clientes inexistentes", async () => {
    await expect(addCustomerNote(ctx.db, AGENT_JOSUE, ctx.customer.id, { text: "   " })).rejects.toBeInstanceOf(
      ZodError,
    );
    await expect(
      addCustomerNote(ctx.db, AGENT_JOSUE, "00000000-0000-4000-8000-0000000000ff", { text: "Hola" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("ubicación de direcciones para el mapa", () => {
  it("ubica las direcciones al crear el cliente", async () => {
    const { addresses } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ phone: "786 555 0700" }),
    );
    expect(addresses[0]).toMatchObject({ lat: 25.77, lng: -80.19 });
  });

  it("vuelve a ubicar la dirección cuando cambia, pero no cuando solo cambian las notas", async () => {
    const { customer, addresses } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ phone: "786 555 0701" }),
    );
    const notesOnly = await updateAddress(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id, addresses[0].id, {
      notes: "Portón azul",
    });
    expect(notesOnly).toMatchObject({ lat: 25.77, lng: -80.19 });

    const moved = await updateAddress(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id, addresses[0].id, {
      city: "Hialeah",
    });
    expect(moved).toMatchObject({ lat: 25.86, lng: -80.28 });

    const unknown = await updateAddress(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id, addresses[0].id, {
      city: "Pueblo Desconocido",
    });
    expect(unknown.lat).toBeNull();
    expect(unknown.lng).toBeNull();
  });

  it("vuelve a ubicar una dirección mal puesta y respeta las coordenadas elegidas a mano", async () => {
    const { customer, addresses } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ phone: "786 555 0703" }),
    );
    await ctx.db.update(addressesTable).set({ lat: 25.7, lng: -80.1 }).where(eq(addressesTable.id, addresses[0].id));
    const relocated = await relocateAddress(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id, addresses[0].id);
    expect(relocated.found).toBe(true);
    expect(relocated.address).toMatchObject({ lat: 25.77, lng: -80.19 });

    const picked = await updateAddress(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id, addresses[0].id, {
      line1: "1 Alhambra Plz",
      city: "Coral Gables",
      lat: 25.75,
      lng: -80.26,
    });
    expect(picked).toMatchObject({ lat: 25.75, lng: -80.26 });
    await expect(
      relocateAddress(ctx.db, EXPERT_CLEANERS_COMPANY_ID, ctx.customer.id, addresses[0].id),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("si no encuentra la nueva ubicación conserva la anterior", async () => {
    const { customer, addresses } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ phone: "786 555 0704" }),
    );
    await ctx.db
      .update(addressesTable)
      .set({ lat: 25.7, lng: -80.1, city: "Ciudad Rara" })
      .where(eq(addressesTable.id, addresses[0].id));
    const result = await relocateAddress(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id, addresses[0].id);
    expect(result.found).toBe(false);
    expect(result.address).toMatchObject({ lat: 25.7, lng: -80.1 });
  });

  it("completa y guarda las coordenadas de direcciones guardadas antes de este cambio", async () => {
    const { customer, addresses } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ phone: "786 555 0702" }),
    );
    const [legacy] = await ctx.db
      .update(addressesTable)
      .set({ lat: null, lng: null })
      .where(eq(addressesTable.id, addresses[0].id))
      .returning();

    const found = await locateMissingAddresses(ctx.db, [legacy, legacy]);
    expect(found.get(legacy.id)).toEqual({ lat: 25.77, lng: -80.19 });
    const [saved] = (await getCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id)).addresses;
    expect(saved).toMatchObject({ lat: 25.77, lng: -80.19 });
  });
});

describe("clientes repetidos", () => {
  it("no crea otro cliente si ya existe uno con el mismo nombre y teléfono", async () => {
    const first = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ firstName: "Marta", phone: "786 555 0900" }),
    );
    const again = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ firstName: "  marta ", lastName: "PÉREZ", phone: "(786) 555-0900" }),
    );
    expect(first.existing).toBe(false);
    expect(again.existing).toBe(true);
    expect(again.customer.id).toBe(first.customer.id);
  });

  it("dos envíos simultáneos del mismo formulario dejan un solo cliente", async () => {
    const input = newCustomer({ firstName: "Doble", lastName: "Clic", phone: "786 555 0901" });
    const [a, b] = await Promise.all([
      createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, input),
      createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, input),
    ]);
    expect(a.customer.id).toBe(b.customer.id);
    expect([a.existing, b.existing].sort()).toEqual([false, true]);
  });

  it("sí crea a otra persona con el mismo teléfono y avisa del posible duplicado", async () => {
    const first = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ firstName: "Pedro", phone: "786 555 0902" }),
    );
    const relative = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ firstName: "Ana", phone: "786 555 0902" }),
    );
    expect(relative.existing).toBe(false);
    expect(relative.customer.id).not.toBe(first.customer.id);
    expect(relative.duplicates.map((d) => d.id)).toContain(first.customer.id);
  });
});

describe("eliminar cliente", () => {
  const ADMIN = { id: AGENT_JOSUE.id, name: "Admin", role: "admin" as const, companyId: EXPERT_CLEANERS_COMPANY_ID };

  it("solo el súper admin elimina, y se lleva direcciones y notas", async () => {
    const { customer } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ firstName: "Borrable", phone: "786 555 0777" }),
    );
    await addCustomerNote(ctx.db, AGENT_JOSUE, customer.id, { text: "Nota" });
    await expect(deleteCustomer(ctx.db, AGENT_JOSUE, customer.id)).rejects.toMatchObject({ code: "forbidden" });

    await deleteCustomer(ctx.db, ADMIN, customer.id);
    await expect(getCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id)).rejects.toMatchObject({
      code: "not_found",
    });
    const left = await ctx.db.select().from(addressesTable).where(eq(addressesTable.customerId, customer.id));
    expect(left).toHaveLength(0);
  });

  it("pide el código para eliminar clientes con citas y rechaza clientes inexistentes", async () => {
    await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date: "2026-11-03" }));
    const detail = await getCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, ctx.customer.id);
    expect(detail.appointmentCount).toBeGreaterThan(0);
    await expect(deleteCustomer(ctx.db, ADMIN, ctx.customer.id)).rejects.toMatchObject({
      code: "confirmation_required",
    });
    await expect(deleteCustomer(ctx.db, ADMIN, ctx.customer.id, { confirmCode: "CLI-0000" })).rejects.toMatchObject({
      code: "confirmation_required",
    });
    await expect(deleteCustomer(ctx.db, ADMIN, "00000000-0000-4000-8000-0000000000fe")).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("unir clientes repetidos", () => {
  const ADMIN = { id: AGENT_JOSUE.id, name: "Admin", role: "admin" as const, companyId: EXPERT_CLEANERS_COMPANY_ID };
  const second = { line1: "77 Ocean Dr", unit: "", city: "Miami Beach", state: "FL", zip: "33139" };

  it("mueve citas, direcciones y notas al cliente que se queda y borra el repetido", async () => {
    const { customer: keep } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ firstName: "Marta", lastName: "Gil", phone: "786 555 0901" }),
    );
    const { customer: dup, addresses: dupAddresses } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({
        firstName: "Marta",
        lastName: "Gil Ruiz",
        phone: "(786) 555-0901",
        email: "marta@correo.test",
        notes: "Llamar antes",
        addresses: [{ ...home, line1: home.line1.toUpperCase() }, second],
      }),
    );
    await addCustomerNote(ctx.db, AGENT_JOSUE, dup.id, { text: "Nota del repetido" });
    const { appointment } = await createAppointment(
      ctx.db,
      AGENT_JOSUE,
      appointmentInput(ctx, { customerId: dup.id, addressId: dupAddresses[0].id, date: "2026-11-04" }),
    );

    expect((await possibleDuplicates(ctx.db, dup)).map((c) => c.id)).toContain(keep.id);
    await expect(mergeCustomers(ctx.db, AGENT_JOSUE, dup.id, keep.id)).rejects.toMatchObject({ code: "forbidden" });

    const result = await mergeCustomers(ctx.db, ADMIN, dup.id, keep.id);
    expect(result.movedAppointments).toBe(1);
    await expect(getCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, dup.id)).rejects.toMatchObject({ code: "not_found" });

    const detail = await getCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, keep.id);
    expect(detail.email).toBe("marta@correo.test");
    expect(detail.notes).toBe("Llamar antes");
    expect(detail.addresses.map((a) => a.line1).sort()).toEqual([home.line1, second.line1].sort());
    expect(detail.history.map((n) => n.text)).toEqual(
      expect.arrayContaining(["Nota del repetido", expect.stringContaining(dup.code)]),
    );
    const moved = await getAppointment(ctx.db, EXPERT_CLEANERS_COMPANY_ID, appointment.id);
    expect(moved.customerId).toBe(keep.id);
    expect(moved.address.customerId).toBe(keep.id);
    expect(moved.history.some((h) => h.field === "customer" && h.toValue === keep.code)).toBe(true);
  });

  it("no une un cliente consigo mismo y busca por código", async () => {
    await expect(mergeCustomers(ctx.db, ADMIN, ctx.customer.id, ctx.customer.id)).rejects.toMatchObject({
      code: "same_customer",
    });
    expect((await findCustomerByCode(ctx.db, EXPERT_CLEANERS_COMPANY_ID, ctx.customer.code.toLowerCase()))?.id).toBe(
      ctx.customer.id,
    );
    expect(
      (await findCustomerByCode(ctx.db, EXPERT_CLEANERS_COMPANY_ID, ctx.customer.code.replace("CLI-", "")))?.id,
    ).toBe(ctx.customer.id);
    expect(await findCustomerByCode(ctx.db, EXPERT_CLEANERS_COMPANY_ID, "CLI-99999")).toBeNull();
  });
});

describe("ordenar y filtrar clientes", () => {
  const base = { addresses: [home] };

  beforeAll(async () => {
    await createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, {
      ...base,
      firstName: "María",
      lastName: "Ñúñez",
      phone: "305-555-6001",
    });
    await createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, {
      ...base,
      firstName: "Maria José",
      lastName: "Arias",
      phone: "305-555-6002",
      allowMarketing: true,
      addresses: [{ ...office }],
    });
    await createCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, {
      ...base,
      firstName: "Rosamaría",
      lastName: "Báez",
      phone: "305-555-6003",
    });
  });

  it("encuentra todas las Marías sin importar acentos ni mayúsculas", async () => {
    const { items, total } = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "maria" });
    expect(items.map((c) => c.firstName).sort()).toEqual(["Maria José", "María", "Rosamaría"].sort());
    expect(total).toBe(3);
    expect(
      (await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "NUNEZ" })).items.map((c) => c.firstName),
    ).toEqual(["María"]);
  });

  it("ordena por código, nombre y fecha de creación en ambos sentidos", async () => {
    const codes = (
      await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "maria", sort: "code_asc" })
    ).items.map((c) => c.code);
    expect(codes).toEqual([...codes].sort((a, b) => Number(a.slice(4)) - Number(b.slice(4))));
    const desc = (
      await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "maria", sort: "code_desc" })
    ).items.map((c) => c.code);
    expect(desc).toEqual([...codes].reverse());
    const names = (
      await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "maria", sort: "first_asc" })
    ).items.map((c) => c.firstName);
    expect(names).toEqual(["María", "Maria José", "Rosamaría"]);
    const recent = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { sort: "recent", limit: 1 });
    expect(recent.items[0].firstName).not.toBe(ctx.customer.firstName);
    const oldest = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { sort: "oldest", limit: 1 });
    expect(oldest.items[0].id).toBe(ctx.customer.id);
  });

  it("filtra por ciudad, promociones, citas y fecha de creación", async () => {
    const doral = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "maria", city: "doral" });
    expect(doral.items.map((c) => c.firstName)).toEqual(["Maria José"]);
    const promos = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "maria", marketing: "yes" });
    expect(promos.items.map((c) => c.firstName)).toEqual(["Maria José"]);
    const without = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "maria", appointments: "without" });
    expect(without.total).toBe(3);
    expect(
      (await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "maria", appointments: "with" })).total,
    ).toBe(0);
    expect(
      (await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "maria", createdTo: "2000-01-01" })).total,
    ).toBe(0);
    expect(
      (await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, { q: "maria", createdFrom: "2000-01-01" })).total,
    ).toBe(3);
  });

  it("ignora valores de filtros inválidos y cuenta las citas", async () => {
    const result = await searchCustomers(ctx.db, EXPERT_CLEANERS_COMPANY_ID, {
      q: "maria",
      sort: "raro",
      marketing: "x",
      createdFrom: "nope",
    });
    expect(result.total).toBe(3);
    expect(result.items[0].appointmentCount).toBe(0);
  });
});

describe("eliminar cliente con citas", () => {
  const ADMIN = { id: AGENT_JOSUE.id, name: "Admin", role: "admin" as const, companyId: EXPERT_CLEANERS_COMPANY_ID };

  it("con el código correcto borra el cliente, sus citas y las fotos guardadas", async () => {
    const { customer, addresses } = await createCustomer(
      ctx.db,
      EXPERT_CLEANERS_COMPANY_ID,
      newCustomer({ firstName: "Borrar", lastName: "Con Citas", phone: "786 555 0991" }),
    );
    const { appointment } = await createAppointment(
      ctx.db,
      AGENT_JOSUE,
      appointmentInput(ctx, { customerId: customer.id, addressId: addresses[0].id, date: "2026-11-09" }),
    );
    await ctx.db.insert(appointmentPhotosTable).values({
      appointmentId: appointment.id,
      storagePath: `appointments/${appointment.id}/foto.jpg`,
      contentType: "image/jpeg",
      sizeBytes: 10,
    });
    const removed: string[] = [];
    const storage = { remove: async (path: string) => void removed.push(path) };

    const result = await deleteCustomer(ctx.db, ADMIN, customer.id, {
      confirmCode: customer.code.toLowerCase(),
      storage,
    });
    expect(result.appointments).toBe(1);
    expect(removed).toEqual([`appointments/${appointment.id}/foto.jpg`]);
    await expect(getCustomer(ctx.db, EXPERT_CLEANERS_COMPANY_ID, customer.id)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(getAppointment(ctx.db, EXPERT_CLEANERS_COMPANY_ID, appointment.id)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
