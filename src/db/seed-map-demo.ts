import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { createAppointment, type Db } from "@/server/appointments";

type NewCustomerAddress = {
  code: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
};

const NEW_CUSTOMERS: NewCustomerAddress[] = [
  {
    code: "CLI-2001",
    firstName: "Patricia",
    lastName: "Gómez",
    phone: "305-555-0201",
    email: "patricia.gomez@example.com",
    line1: "1200 Brickell Ave",
    city: "Miami",
    state: "FL",
    zip: "33131",
    lat: 25.765,
    lng: -80.1936,
  },
  {
    code: "CLI-2002",
    firstName: "Luis",
    lastName: "Fernández",
    phone: "305-555-0202",
    email: "luis.fernandez@example.com",
    line1: "8400 NW 36th St",
    city: "Doral",
    state: "FL",
    zip: "33166",
    lat: 25.806,
    lng: -80.318,
  },
  {
    code: "CLI-2003",
    firstName: "Marta",
    lastName: "Suárez",
    phone: "305-555-0203",
    email: "marta.suarez@example.com",
    line1: "1000 E 9th St",
    city: "Hialeah",
    state: "FL",
    zip: "33010",
    lat: 25.845,
    lng: -80.2781,
  },
  {
    code: "CLI-2004",
    firstName: "Roberto",
    lastName: "Díaz",
    phone: "305-555-0204",
    email: "roberto.diaz@example.com",
    line1: "9400 SW 87th Ave",
    city: "Kendall",
    state: "FL",
    zip: "33176",
    lat: 25.6793,
    lng: -80.3415,
  },
  {
    code: "CLI-2005",
    firstName: "Carolina",
    lastName: "Rojas",
    phone: "305-555-0205",
    email: "carolina.rojas@example.com",
    line1: "100 N Krome Ave",
    city: "Homestead",
    state: "FL",
    zip: "33030",
    lat: 25.4687,
    lng: -80.4776,
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL es requerida");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema }) as unknown as Db;

  const [agent] = await db.select().from(schema.profiles).where(eq(schema.profiles.name, "Josué Perfecto")).limit(1);
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
  const [existingCustomer] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.code, "CLI-1001"))
    .limit(1);
  const [existingAddress] = await db
    .select()
    .from(schema.addresses)
    .where(eq(schema.addresses.customerId, existingCustomer.id))
    .limit(1);

  const created: { customerId: string; addressId: string }[] = [];
  for (const c of NEW_CUSTOMERS) {
    const [customer] = await db
      .insert(schema.customers)
      .values({ code: c.code, firstName: c.firstName, lastName: c.lastName, phone: c.phone, email: c.email })
      .returning();
    const [address] = await db
      .insert(schema.addresses)
      .values({
        customerId: customer.id,
        line1: c.line1,
        unit: "",
        city: c.city,
        state: c.state,
        zip: c.zip,
        lat: c.lat,
        lng: c.lng,
      })
      .returning();
    created.push({ customerId: customer.id, addressId: address.id });
  }

  const [brickell, doral, hialeah, kendall, homestead] = created;

  const actor = { id: agent.id, name: agent.name, role: agent.role };
  const date = new Date().toISOString().slice(0, 10);

  // Carlos — Miami Central
  await createAppointment(db, actor, {
    customerId: existingCustomer.id,
    addressId: existingAddress.id,
    serviceId: carpet.id,
    technicianId: carlos.id,
    date,
    startMin: 9 * 60,
    durationMin: 90,
    specs: { length: 12, width: 10, carpetType: "Sintética", quantity: 1 },
    notes: "",
  });
  await createAppointment(db, actor, {
    customerId: brickell.customerId,
    addressId: brickell.addressId,
    serviceId: sofa.id,
    technicianId: carlos.id,
    date,
    startMin: 11 * 60 + 30,
    durationMin: 60,
    specs: { sofaType: "Tela", seats: 3 },
    notes: "",
  });

  // Yolanda — Doral / Hialeah
  await createAppointment(db, actor, {
    customerId: doral.customerId,
    addressId: doral.addressId,
    serviceId: carpet.id,
    technicianId: yolanda.id,
    date,
    startMin: 9 * 60 + 30,
    durationMin: 90,
    specs: { length: 10, width: 8, carpetType: "Lana", quantity: 1 },
    notes: "",
  });
  await createAppointment(db, actor, {
    customerId: hialeah.customerId,
    addressId: hialeah.addressId,
    serviceId: sofa.id,
    technicianId: yolanda.id,
    date,
    startMin: 13 * 60,
    durationMin: 60,
    specs: { sofaType: "Cuero", seats: 2 },
    notes: "",
  });

  // Osvaldo — Kendall / Homestead
  await createAppointment(db, actor, {
    customerId: kendall.customerId,
    addressId: kendall.addressId,
    serviceId: sofa.id,
    technicianId: osvaldo.id,
    date,
    startMin: 10 * 60,
    durationMin: 60,
    specs: { sofaType: "Microfibra", seats: 4 },
    notes: "",
  });
  await createAppointment(db, actor, {
    customerId: homestead.customerId,
    addressId: homestead.addressId,
    serviceId: carpet.id,
    technicianId: osvaldo.id,
    date,
    startMin: 14 * 60,
    durationMin: 90,
    specs: { length: 14, width: 12, carpetType: "Sintética", quantity: 2 },
    notes: "",
  });

  await client.end();
  console.log(`6 citas de prueba con direcciones distintas creadas para ${date}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
