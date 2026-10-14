import { describe, expect, it } from "vitest";
import type { ServiceField } from "@/db/schema";
import {
  SOFA_DIMENSIONS,
  fieldsForService,
  isSofaService,
  itemsPayloadFromValues,
  parseDollars,
  readItemValues,
  serviceLabel,
  summarizeItems,
  validateItems,
} from "@/domain/appointment-items";

const seats: ServiceField = { key: "seats", label: "Número de asientos", type: "number", required: true };
const sofa = { id: "sofa", name: "Limpieza de Sofás", fields: [seats] };
const carpet = {
  id: "carpet",
  name: "Limpieza de Alfombras",
  fields: [{ key: "length", label: "Largo (ft)", type: "number", required: true } as ServiceField],
};

describe("servicios de sofá", () => {
  it("reconoce sofás por el nombre o el slug", () => {
    expect(isSofaService({ name: "Limpieza de Sofás" })).toBe(true);
    expect(isSofaService({ name: "Sillones reclinables" })).toBe(true);
    expect(isSofaService({ name: "Sectional deep clean" })).toBe(true);
    expect(isSofaService({ name: "Tapicería", slug: "sofa-premium" })).toBe(true);
    expect(isSofaService({ name: "Limpieza de Alfombras" })).toBe(false);
    expect(isSofaService({ name: "Sofacama de muestra" })).toBe(false);
  });

  it("agrega largo y ancho a los sofás sin duplicarlos", () => {
    expect(fieldsForService(sofa).map((f) => f.key)).toEqual(["seats", "sofaLength", "sofaWidth"]);
    expect(fieldsForService(carpet)).toEqual(carpet.fields);
    const withOwn = { name: "Sofá", fields: [{ ...seats, key: "largo", label: "Largo total" }] };
    expect(fieldsForService(withOwn)).toHaveLength(1);
    expect(SOFA_DIMENSIONS.every((field) => !field.required)).toBe(true);
  });
});

describe("precios", () => {
  it("lee dólares con o sin símbolo y comas", () => {
    expect(parseDollars("120")).toBe(12000);
    expect(parseDollars("$1,150.5")).toBe(115050);
    expect(parseDollars(" ")).toBeNull();
    expect(parseDollars("12.345")).toBeNaN();
    expect(parseDollars("-5")).toBeNaN();
  });
});

describe("lectura de artículos", () => {
  const values = {
    "items.1.serviceId": "carpet",
    "items.1.price": "80",
    "items.1.spec.length": "12",
    "items.0.serviceId": "sofa",
    "items.0.price": "",
    "items.0.spec.seats": "3",
    "items.0.spec.sofaLength": "84",
    notes: "x",
  };

  it("ordena los artículos por posición", () => {
    const items = readItemValues(values);
    expect(items.map((item) => item.serviceId)).toEqual(["sofa", "carpet"]);
    expect(items[0].specs).toEqual({ seats: "3", sofaLength: "84" });
  });

  it("valida y convierte cada artículo", () => {
    const find = (id: string) => [sofa, carpet].find((service) => service.id === id);
    const { inputs, errors } = validateItems(readItemValues(values), find);
    expect(errors).toEqual({});
    expect(inputs).toEqual([
      { serviceId: "sofa", specs: { seats: 3, sofaLength: 84 } },
      { serviceId: "carpet", specs: { length: 12 }, priceCents: 8000 },
    ]);
  });

  it("marca el artículo sin servicio y los campos obligatorios", () => {
    const find = (id: string) => [sofa].find((service) => service.id === id);
    const { errors } = validateItems(
      [
        { serviceId: "sofa", price: "", specs: {} },
        { serviceId: "", price: "", specs: {} },
      ],
      find,
    );
    expect(errors["items.0.spec.seats"]).toBe("Este campo es obligatorio");
    expect(errors["items.1.serviceId"]).toBe("Elige un servicio");
    expect(validateItems([], find).errors["items.0.serviceId"]).toMatch(/al menos un servicio/);
  });

  it("arma el pedido del panel sin conocer los servicios", () => {
    expect(itemsPayloadFromValues({ ...values, durationMin: "90" })).toEqual({
      items: [
        { serviceId: "sofa", specs: { seats: 3, sofaLength: 84 } },
        { serviceId: "carpet", specs: { length: 12 }, priceCents: 8000 },
      ],
      durationMin: 90,
    });
  });
});

describe("textos", () => {
  it("resume artículos y etiqueta la cita", () => {
    expect(summarizeItems([{ serviceName: "Sofá", priceCents: 12000 }])).toBe("Sofá $120.00");
    const appointment = {
      service: { name: "Sofá" },
      items: [{ service: { name: "Sofá" } }, { service: { name: "Alfombra" } }],
    };
    expect(serviceLabel(appointment)).toBe("Sofá +1");
    expect(serviceLabel({ service: { name: "Sofá" }, items: [] })).toBe("Sofá");
  });
});
