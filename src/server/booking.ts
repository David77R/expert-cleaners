import { and, eq, gte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { fieldsForService } from "@/domain/appointment-items";
import { availableSlots, bookingWindow, freeTechnicians, type BusyBlock } from "@/domain/booking";
import { isValidPhone } from "@/domain/customer-rules";
import { minutesNowIn, todayIn } from "@/domain/date-rules";
import { weekdayIndex } from "@/domain/calendar-view";
import { isoDate } from "@/domain/schemas";
import { VEHICLE_SIZES, priceForSize, type VehicleSize } from "@/domain/vehicles";
import { createAppointment, type Db } from "@/server/appointments";
import { addAddress, createCustomer } from "@/server/customers";
import { createVehicle } from "@/server/vehicles";

const { appointments, companies, profiles, services, technicians, vehicles } = schema;

export const BOOKING_AGENT = {
  id: "00000000-0000-4000-8000-0000000b0001",
  name: "Reserva en línea",
  role: "agent" as const,
};

export const ONLINE_BOOKING_ALERT = { key: "online-booking", label: "Reserva en línea", level: "info" as const };

const MAX_UPCOMING_PER_CUSTOMER = 3;

export type BookingService = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
  basePriceCents: number;
  durationMin: number;
  sizePrices: schema.Service["sizePrices"];
};

export type BookingCompany = Pick<schema.Company, "id" | "active" | "settings">;

export async function bookingCompany(db: Db, slug: string): Promise<schema.Company> {
  const [company] = await db.select().from(companies).where(eq(companies.slug, slug.trim().toLowerCase())).limit(1);
  if (!company) throw new DomainError("not_found", "Las reservas en línea no están activas");
  assertEnabled(company);
  return company;
}

function assertEnabled(company: BookingCompany) {
  if (!company.active || !company.settings.features.publicBooking) {
    throw new DomainError("not_found", "Las reservas en línea no están activas");
  }
}

function currentWindow(company: BookingCompany, now: Date = new Date()) {
  return bookingWindow(
    todayIn(undefined, now),
    minutesNowIn(undefined, now),
    company.settings.booking.minNoticeHours,
    company.settings.booking.maxDaysAhead,
  );
}

export async function bookingServices(db: Db, company: BookingCompany): Promise<BookingService[]> {
  assertEnabled(company);
  const rows = await db
    .select()
    .from(services)
    .where(
      and(eq(services.companyId, company.id), eq(services.active, true), sql`${services.slug} not like 'eliminado-%'`),
    );
  return rows
    .filter((row) => !fieldsForService(row).some((field) => field.required))
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      icon: row.icon,
      category: row.category,
      basePriceCents: row.basePriceCents,
      durationMin: row.durationMin,
      sizePrices: row.sizePrices,
    }))
    .sort((a, b) => a.basePriceCents - b.basePriceCents);
}

async function dayLoad(db: Db, companyId: string, date: string) {
  const [team, booked] = await Promise.all([
    db
      .select()
      .from(technicians)
      .where(and(eq(technicians.companyId, companyId), eq(technicians.active, true))),
    db
      .select({
        technicianId: appointments.technicianId,
        startMin: appointments.startMin,
        durationMin: appointments.durationMin,
        deliveryDate: appointments.deliveryDate,
        deliveryStartMin: appointments.deliveryStartMin,
        deliveryDurationMin: appointments.deliveryDurationMin,
        deliveryTechnicianId: appointments.deliveryTechnicianId,
        date: appointments.date,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, companyId),
          ne(appointments.status, "cancelled"),
          sql`(${appointments.date} = ${date} or ${appointments.deliveryDate} = ${date})`,
        ),
      ),
  ]);
  const busy: BusyBlock[] = [];
  for (const row of booked) {
    if (row.date === date) {
      busy.push({ technicianId: row.technicianId, startMin: row.startMin, durationMin: row.durationMin });
    }
    if (row.deliveryDate === date && row.deliveryStartMin !== null && row.deliveryTechnicianId) {
      busy.push({
        technicianId: row.deliveryTechnicianId,
        startMin: row.deliveryStartMin,
        durationMin: row.deliveryDurationMin ?? 60,
      });
    }
  }
  return { team, busy };
}

function serviceDuration(company: BookingCompany, service: { durationMin: number }): number {
  return service.durationMin > 0 ? service.durationMin : company.settings.booking.slotMinutes;
}

async function companyService(db: Db, companyId: string, serviceId: string) {
  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.companyId, companyId)))
    .limit(1);
  return service ?? null;
}

export async function bookingAvailability(
  db: Db,
  company: BookingCompany,
  rawDate: string,
  rawServiceId: string,
  now: Date = new Date(),
) {
  assertEnabled(company);
  const date = isoDate.parse(rawDate);
  const serviceId = z.uuid().parse(rawServiceId);
  const service = await companyService(db, company.id, serviceId);
  if (!service || !service.active) throw new DomainError("service_unavailable", "Ese paquete no está disponible");
  const { team, busy } = await dayLoad(db, company.id, date);
  const slots = availableSlots({
    date,
    hours: company.settings.booking.hours[weekdayIndex(date)] ?? null,
    stepMin: company.settings.booking.slotMinutes,
    durationMin: serviceDuration(company, service),
    technicians: team,
    busy,
    window: currentWindow(company, now),
  });
  return slots.map((slot) => slot.startMin);
}

const text = (max: number) => z.string().trim().max(max).default("");

export const bookingSchema = z.object({
  serviceId: z.uuid("Elige un paquete"),
  size: z.enum(VEHICLE_SIZES),
  make: text(40),
  model: text(40),
  color: text(30),
  date: isoDate,
  startMin: z.number().int().min(0).max(1439),
  firstName: z.string().trim().min(1, "Escribe tu nombre").max(60),
  lastName: z.string().trim().min(1, "Escribe tu apellido").max(60),
  phone: z.string().trim().refine(isValidPhone, "Teléfono no válido"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .refine((value) => value === "" || z.email().safeParse(value).success, "Correo no válido")
    .default(""),
  line1: z.string().trim().min(3, "Escribe la dirección").max(120),
  unit: text(30),
  city: z.string().trim().min(2, "Escribe la ciudad").max(60),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Código postal no válido"),
  notes: text(500),
  website: z.string().max(0).default(""),
});

export type BookingInput = z.input<typeof bookingSchema>;

function sameAddress(a: { line1: string; zip: string }, b: { line1: string; zip: string }): boolean {
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return norm(a.line1) === norm(b.line1) && a.zip.slice(0, 5) === b.zip.slice(0, 5);
}

async function ensureBookingAgent(db: Db) {
  await db
    .insert(profiles)
    .values({ id: BOOKING_AGENT.id, name: BOOKING_AGENT.name, role: "agent", active: false })
    .onConflictDoNothing();
}

export async function createBooking(db: Db, company: BookingCompany, raw: BookingInput, now: Date = new Date()) {
  assertEnabled(company);
  const input = bookingSchema.parse(raw);
  const service = await companyService(db, company.id, input.serviceId);
  if (!service || !service.active || fieldsForService(service).some((field) => field.required)) {
    throw new DomainError("service_unavailable", "Ese paquete no está disponible");
  }

  const durationMin = serviceDuration(company, service);
  const window = currentWindow(company, now);
  const { team, busy } = await dayLoad(db, company.id, input.date);
  const open = availableSlots({
    date: input.date,
    hours: company.settings.booking.hours[weekdayIndex(input.date)] ?? null,
    stepMin: company.settings.booking.slotMinutes,
    durationMin,
    technicians: team,
    busy,
    window,
  }).some((slot) => slot.startMin === input.startMin);
  const technicianId = open ? freeTechnicians(input.date, input.startMin, durationMin, team, busy)[0] : undefined;
  if (!technicianId) {
    throw new DomainError("slot_taken", "Esa hora ya no está disponible. Elige otra, por favor.");
  }

  const address = {
    line1: input.line1,
    unit: input.unit,
    city: input.city,
    state: company.settings.location.state,
    zip: input.zip,
  };
  const created = await createCustomer(db, company.id, {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    ...(input.email ? { email: input.email } : {}),
    addresses: [address],
  });
  const customerId = created.customer.id;

  const upcoming = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.companyId, company.id),
        eq(appointments.customerId, customerId),
        eq(appointments.agentId, BOOKING_AGENT.id),
        ne(appointments.status, "cancelled"),
        gte(appointments.date, todayIn(undefined, now)),
      ),
    );
  if (upcoming.length >= MAX_UPCOMING_PER_CUSTOMER) {
    throw new DomainError(
      "too_many_bookings",
      "Ya tienes varias reservas pendientes. Escríbenos para ayudarte con una nueva.",
    );
  }

  const savedAddress =
    created.addresses.find((saved) => sameAddress(saved, address)) ??
    (await addAddress(db, company.id, customerId, address));

  const owned = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.customerId, customerId), eq(vehicles.companyId, company.id)));
  const match = owned.find(
    (vehicle) =>
      vehicle.size === input.size &&
      vehicle.make.toLowerCase() === input.make.toLowerCase() &&
      vehicle.model.toLowerCase() === input.model.toLowerCase(),
  );
  const vehicle =
    match ??
    (await createVehicle(db, company.id, customerId, {
      size: input.size,
      make: input.make,
      model: input.model,
      color: input.color,
    }));

  await ensureBookingAgent(db);
  const result = await createAppointment(
    db,
    { ...BOOKING_AGENT, companyId: company.id },
    {
      customerId,
      addressId: savedAddress.id,
      technicianId,
      date: input.date,
      startMin: input.startMin,
      durationMin,
      items: [
        {
          serviceId: service.id,
          specs: {},
          priceCents: priceForSize(service, input.size as VehicleSize),
          vehicleId: vehicle.id,
        },
      ],
      notes: input.notes,
      alerts: [ONLINE_BOOKING_ALERT],
    },
  );

  return {
    code: result.appointment.code,
    date: result.appointment.date,
    startMin: result.appointment.startMin,
    priceCents: result.appointment.priceCents,
    serviceName: service.name,
  };
}
