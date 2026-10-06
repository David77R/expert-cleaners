import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { createAppointment, type Db } from "@/server/appointments";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL es requerida");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema }) as unknown as Db;

  const [agent] = await db.select().from(schema.profiles).where(eq(schema.profiles.name, "Josué Perfecto")).limit(1);
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.code, "CLI-1001")).limit(1);
  const [address] = await db
    .select()
    .from(schema.addresses)
    .where(eq(schema.addresses.customerId, customer.id))
    .limit(1);
  const [carpet] = await db.select().from(schema.services).where(eq(schema.services.slug, "carpet")).limit(1);
  const [sofa] = await db.select().from(schema.services).where(eq(schema.services.slug, "sofa")).limit(1);
  const [carlos] = await db
    .select()
    .from(schema.technicians)
    .where(eq(schema.technicians.name, "Carlos Betancourt"))
    .limit(1);
  const [yolanda] = await db
    .select()
    .from(schema.technicians)
    .where(eq(schema.technicians.name, "Yolanda Hernández"))
    .limit(1);
  const [osvaldo] = await db
    .select()
    .from(schema.technicians)
    .where(eq(schema.technicians.name, "Osvaldo Reyes"))
    .limit(1);

  const actor = { id: agent.id, name: agent.name, role: agent.role };
  const date = new Date().toISOString().slice(0, 10);

  await createAppointment(db, actor, {
    customerId: customer.id,
    addressId: address.id,
    serviceId: carpet.id,
    technicianId: carlos.id,
    date,
    startMin: 9 * 60,
    durationMin: 90,
    specs: { length: 12, width: 10, carpetType: "Sintética", quantity: 1 },
    notes: "",
  });

  await createAppointment(db, actor, {
    customerId: customer.id,
    addressId: address.id,
    serviceId: sofa.id,
    technicianId: carlos.id,
    date,
    startMin: 10 * 60,
    durationMin: 60,
    specs: { sofaType: "Tela", seats: 3 },
    notes: "Esta se solapa con la anterior a propósito, para probar el aviso de conflicto.",
  });

  await createAppointment(db, actor, {
    customerId: customer.id,
    addressId: address.id,
    serviceId: sofa.id,
    technicianId: yolanda.id,
    date,
    startMin: 13 * 60,
    durationMin: 60,
    specs: { sofaType: "Cuero", seats: 2 },
    notes: "",
  });

  await createAppointment(db, actor, {
    customerId: customer.id,
    addressId: address.id,
    serviceId: carpet.id,
    technicianId: osvaldo.id,
    date,
    startMin: 9 * 60 + 30,
    durationMin: 90,
    specs: { length: 8, width: 6, carpetType: "Lana", quantity: 2 },
    notes: "",
  });

  await client.end();
  console.log(`4 citas de prueba creadas para ${date}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
