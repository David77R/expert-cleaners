import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const AGENT_JOSUE = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Josué Perfecto",
  role: "agent" as const,
};
export const AGENT_JUANCHO = { id: "00000000-0000-4000-8000-000000000002", name: "Juancho", role: "agent" as const };

export async function seedBase(db: Db) {
  await db.insert(schema.profiles).values([
    { id: AGENT_JOSUE.id, name: AGENT_JOSUE.name, role: "agent" },
    { id: AGENT_JUANCHO.id, name: AGENT_JUANCHO.name, role: "agent" },
  ]);

  const techs = await db
    .insert(schema.technicians)
    .values([
      { name: "Carlos Betancourt", color: "#DB962A", zone: "Miami Central" },
      { name: "Yolanda Hernández", color: "#4C5FE0", zone: "Doral / Hialeah" },
      { name: "Osvaldo Reyes", color: "#D63F63", zone: "Kendall / Homestead" },
    ])
    .returning();

  const svc = await db
    .insert(schema.services)
    .values([
      {
        slug: "carpet",
        name: "Limpieza de Alfombras",
        category: "Alfombras",
        basePriceCents: 15000,
        durationMin: 90,
        fields: [
          { key: "length", label: "Largo (ft)", type: "number", required: true },
          { key: "width", label: "Ancho (ft)", type: "number", required: true },
          {
            key: "carpetType",
            label: "Tipo de alfombra",
            type: "select",
            required: true,
            options: ["Lana", "Sintética", "Seda"],
          },
          { key: "quantity", label: "Cantidad", type: "number", required: true },
        ],
      },
      {
        slug: "sofa",
        name: "Limpieza de Sofás",
        category: "Sofás y Otros",
        basePriceCents: 9500,
        durationMin: 60,
        fields: [
          {
            key: "sofaType",
            label: "Tipo de sofá",
            type: "select",
            required: true,
            options: ["Tela", "Cuero", "Microfibra"],
          },
          { key: "seats", label: "Número de asientos", type: "number", required: true },
        ],
      },
      {
        slug: "rug-pickup",
        name: "Recogida de Tapetes",
        category: "Tapetes",
        basePriceCents: 4000,
        durationMin: 30,
        twoAddresses: true,
      },
      {
        slug: "rug-delivery",
        name: "Entrega de Tapetes",
        category: "Tapetes",
        basePriceCents: 4000,
        durationMin: 30,
        twoAddresses: true,
      },
    ])
    .returning();

  const customer = await db
    .insert(schema.customers)
    .values({
      code: "CLI-1001",
      firstName: "Andrés",
      lastName: "Molina",
      phone: "305-555-0142",
      email: "andres@example.com",
    })
    .returning();

  const address = await db
    .insert(schema.addresses)
    .values({
      customerId: customer[0].id,
      line1: "1450 SW 8th St",
      unit: "",
      city: "Miami",
      state: "FL",
      zip: "33135",
      lat: 25.7658,
      lng: -80.2201,
    })
    .returning();

  return {
    techs,
    services: Object.fromEntries(svc.map((s) => [s.slug, s])),
    customer: customer[0],
    address: address[0],
  };
}
