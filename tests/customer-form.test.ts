import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import {
  customerFieldErrors,
  customerInputFromForm,
  emptyCustomerForm,
  parseDuplicateIds,
  readCustomerForm,
} from "@/domain/customer-form";
import { createCustomerSchema } from "@/domain/schemas";
import { createCustomer, customersByIds } from "@/server/customers";
import { createTestDb } from "./helpers";

vi.mock("@/server/geocoding", () => ({
  geocodeIfNeeded: async (address: unknown) => address,
}));

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

const complete = {
  firstName: "Laura",
  lastName: "Pérez",
  phone: "(305) 555-0142",
  email: "Laura@Correo.com",
  notes: "Prefiere llamadas",
  allowMarketing: "on",
  line1: "500 Biscayne Blvd",
  unit: "Apt 4B",
  city: "Miami",
  state: "fl",
  zip: "33132",
  addressNotes: "Entrar por atrás",
};

function errorsFor(entries: Record<string, string>) {
  const result = createCustomerSchema.safeParse(customerInputFromForm(readCustomerForm(formData(entries))));
  if (result.success) return {};
  return customerFieldErrors(result.error);
}

describe("lectura del formulario", () => {
  it("empieza vacío con Florida como estado", () => {
    const values = emptyCustomerForm();
    expect(values.state).toBe("FL");
    expect(values.firstName).toBe("");
    expect(values.allowMarketing).toBe("");
  });

  it("ignora campos ausentes y archivos", () => {
    const data = new FormData();
    data.set("firstName", "Ana");
    data.set("lastName", new File(["x"], "x.txt"));
    const values = readCustomerForm(data);
    expect(values.firstName).toBe("Ana");
    expect(values.lastName).toBe("");
    expect(values.phone).toBe("");
  });

  it("interpreta la casilla de promociones", () => {
    expect(readCustomerForm(formData({ allowMarketing: "on" })).allowMarketing).toBe("on");
    expect(readCustomerForm(formData({})).allowMarketing).toBe("");
  });
});

describe("entrada del cliente", () => {
  it("arma una entrada válida con una dirección", () => {
    const input = customerInputFromForm(readCustomerForm(formData(complete)));
    const parsed = createCustomerSchema.parse(input);
    expect(parsed.email).toBe("laura@correo.com");
    expect(parsed.allowMarketing).toBe(true);
    expect(parsed.addresses).toHaveLength(1);
    expect(parsed.addresses[0]).toMatchObject({ line1: "500 Biscayne Blvd", unit: "Apt 4B", state: "FL" });
    expect(parsed.addresses[0].notes).toBe("Entrar por atrás");
  });

  it("convierte los campos opcionales vacíos en ausentes", () => {
    const input = customerInputFromForm(
      readCustomerForm(formData({ ...complete, email: "  ", notes: "", addressNotes: "", unit: "" })),
    );
    expect(input.email).toBeUndefined();
    expect(input.notes).toBeUndefined();
    expect(input.addresses[0].notes).toBeUndefined();
    expect(createCustomerSchema.parse(input).addresses[0].unit).toBe("");
  });

  it("usa Florida cuando el estado queda vacío y lo pone en mayúsculas", () => {
    expect(customerInputFromForm(readCustomerForm(formData({ ...complete, state: "" }))).addresses[0].state).toBe("FL");
    expect(customerInputFromForm(readCustomerForm(formData({ ...complete, state: "ga" }))).addresses[0].state).toBe(
      "GA",
    );
  });
});

describe("errores por campo", () => {
  it("no hay errores con datos completos", () => {
    expect(errorsFor(complete)).toEqual({});
  });

  it("marca los obligatorios vacíos o con solo espacios", () => {
    const errors = errorsFor({ ...complete, firstName: "   ", lastName: "", line1: "", city: " " });
    expect(errors.firstName).toBe("Este campo es obligatorio");
    expect(errors.lastName).toBe("Este campo es obligatorio");
    expect(errors.line1).toBe("Este campo es obligatorio");
    expect(errors.city).toBe("Este campo es obligatorio");
    expect(errors.phone).toBeUndefined();
  });

  it("explica teléfono, correo y código postal", () => {
    const errors = errorsFor({ ...complete, phone: "123", email: "no-es-correo", zip: "1" });
    expect(errors.phone).toMatch(/teléfono válido/);
    expect(errors.email).toMatch(/correo válido/);
    expect(errors.zip).toMatch(/código postal válido/);
  });

  it("mapea las indicaciones de la dirección a su propio campo", () => {
    const error = new ZodError([{ code: "custom", path: ["addresses", 0, "notes"], message: "x" }]);
    expect(customerFieldErrors(error)).toEqual({ addressNotes: "Este campo es obligatorio" });
  });

  it("ignora problemas que no pertenecen a ningún campo", () => {
    const error = new ZodError([{ code: "custom", path: ["addresses"], message: "x" }]);
    expect(customerFieldErrors(error)).toEqual({});
  });

  it("se queda con el primer problema de cada campo", () => {
    const error = new ZodError([
      { code: "custom", path: ["phone"], message: "a" },
      { code: "custom", path: ["phone"], message: "b" },
    ]);
    expect(Object.keys(customerFieldErrors(error))).toEqual(["phone"]);
  });
});

describe("clientes repetidos", () => {
  const isUuid = (value: string) => /^[0-9a-f-]{36}$/.test(value);
  const a = "00000000-0000-4000-8000-000000000001";
  const b = "00000000-0000-4000-8000-000000000002";

  it("lee una lista de ids sin repetir y descarta los inválidos", () => {
    expect(parseDuplicateIds(`${a},${b},${a},no-es-id`, isUuid)).toEqual([a, b]);
    expect(parseDuplicateIds(undefined, isUuid)).toEqual([]);
    expect(parseDuplicateIds("", isUuid)).toEqual([]);
  });

  it("limita la cantidad de ids", () => {
    const many = Array.from({ length: 9 }, (_, i) => `00000000-0000-4000-8000-00000000000${i}`).join(",");
    expect(parseDuplicateIds(many, isUuid)).toHaveLength(5);
    expect(parseDuplicateIds(many, isUuid, 2)).toHaveLength(2);
  });
});

describe("búsqueda por ids", () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>;

  beforeAll(async () => {
    ctx = await createTestDb();
  });

  afterAll(async () => {
    await ctx.client.close();
  });

  const address = { line1: "1 Main St", unit: "", city: "Miami", state: "FL", zip: "33101" };

  it("devuelve los clientes pedidos ordenados por código", async () => {
    const first = await createCustomer(ctx.db, {
      firstName: "Ana",
      lastName: "Uno",
      phone: "786 555 0301",
      addresses: [address],
    });
    const second = await createCustomer(ctx.db, {
      firstName: "Beto",
      lastName: "Dos",
      phone: "786 555 0302",
      addresses: [address],
    });
    await createCustomer(ctx.db, { firstName: "Cora", lastName: "Tres", phone: "786 555 0303", addresses: [address] });

    const found = await customersByIds(ctx.db, [second.customer.id, first.customer.id]);
    expect(found.map((match) => match.firstName)).toEqual(["Ana", "Beto"]);
  });

  it("devuelve una lista vacía sin ids o con ids desconocidos", async () => {
    expect(await customersByIds(ctx.db, [])).toEqual([]);
    expect(await customersByIds(ctx.db, ["00000000-0000-4000-8000-000000000099"])).toEqual([]);
  });

  it("el alta desde el formulario detecta un teléfono repetido", async () => {
    const entries = { ...complete, phone: "(954) 555 0777" };
    const input = customerInputFromForm(readCustomerForm(formData(entries)));
    const first = await createCustomer(ctx.db, input);
    expect(first.duplicates).toHaveLength(0);

    const second = await createCustomer(ctx.db, { ...input, firstName: "Lucía" });
    expect(second.existing).toBe(false);
    expect(second.duplicates.map((match) => match.id)).toEqual([first.customer.id]);
    expect(second.customer.email).toBe("laura@correo.com");
    expect(second.addresses[0].state).toBe("FL");
  });
});
