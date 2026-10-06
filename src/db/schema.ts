import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["agent", "admin"]);
export const appointmentStatus = pgEnum("appointment_status", [
  "not_confirmed",
  "confirmed",
  "rescheduled",
  "cancelled",
  "completed",
]);
export const paymentStatus = pgEnum("payment_status", ["unpaid", "paid"]);
export const invoiceStatus = pgEnum("invoice_status", ["not_generated", "generated", "sent"]);

export type AddressSnapshot = {
  line1: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  notes?: string;
  lat?: number;
  lng?: number;
};

export type ServiceField = {
  key: string;
  label: string;
  type: "number" | "select";
  required: boolean;
  options?: string[];
};

export type AppointmentAlert = {
  key: string;
  label: string;
  level: "attention" | "warning" | "info";
};

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  role: userRole("role").notNull().default("agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    notes: text("notes"),
    allowMarketing: boolean("allow_marketing").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("customers_phone_idx").on(t.phone)],
);

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    line1: text("line1").notNull(),
    unit: text("unit").notNull().default(""),
    city: text("city").notNull(),
    state: text("state").notNull(),
    zip: text("zip").notNull(),
    notes: text("notes"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
  },
  (t) => [index("addresses_customer_idx").on(t.customerId)],
);

export const customerNotes = pgTable("customer_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => profiles.id),
  authorName: text("author_name").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  basePriceCents: integer("base_price_cents").notNull(),
  durationMin: integer("duration_min").notNull(),
  active: boolean("active").notNull().default(true),
  twoAddresses: boolean("two_addresses").notNull().default(false),
  internalNotes: text("internal_notes"),
  detailedSpecs: text("detailed_specs"),
  fields: jsonb("fields").$type<ServiceField[]>().notNull().default([]),
});

export const technicians = pgTable("technicians", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  zone: text("zone").notNull(),
  active: boolean("active").notNull().default(true),
  workDays: smallint("work_days").array().notNull().default([1, 2, 3, 4, 5, 6]),
  shiftStartMin: integer("shift_start_min").notNull().default(420),
  shiftEndMin: integer("shift_end_min").notNull().default(1140),
});

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => profiles.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    addressId: uuid("address_id")
      .notNull()
      .references(() => addresses.id),
    destinationAddress: jsonb("destination_address").$type<AddressSnapshot>(),
    billingAddress: jsonb("billing_address").$type<AddressSnapshot>(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicians.id),
    date: date("date", { mode: "string" }).notNull(),
    startMin: integer("start_min").notNull(),
    durationMin: integer("duration_min").notNull(),
    status: appointmentStatus("status").notNull().default("not_confirmed"),
    paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
    invoiceStatus: invoiceStatus("invoice_status").notNull().default("not_generated"),
    priceCents: integer("price_cents").notNull(),
    notes: text("notes").notNull().default(""),
    specs: jsonb("specs").$type<Record<string, string | number>>().notNull().default({}),
    alerts: jsonb("alerts").$type<AppointmentAlert[]>().notNull().default([]),
    cancellationReason: text("cancellation_reason"),
    rescheduleReason: text("reschedule_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("appointments_date_tech_idx").on(t.date, t.technicianId),
    index("appointments_customer_idx").on(t.customerId),
    index("appointments_status_idx").on(t.status),
  ],
);

export const appointmentHistory = pgTable(
  "appointment_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => profiles.id),
    actorName: text("actor_name").notNull(),
    actorRole: userRole("actor_role").notNull(),
    field: text("field").notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("appointment_history_appt_idx").on(t.appointmentId, t.createdAt)],
);

export const appointmentPhotos = pgTable("appointment_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id")
    .notNull()
    .references(() => appointments.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customersRelations = relations(customers, ({ many }) => ({
  addresses: many(addresses),
  appointments: many(appointments),
  notes: many(customerNotes),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  customer: one(customers, { fields: [addresses.customerId], references: [customers.id] }),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  customer: one(customers, { fields: [appointments.customerId], references: [customers.id] }),
  address: one(addresses, { fields: [appointments.addressId], references: [addresses.id] }),
  service: one(services, { fields: [appointments.serviceId], references: [services.id] }),
  technician: one(technicians, { fields: [appointments.technicianId], references: [technicians.id] }),
  agent: one(profiles, { fields: [appointments.agentId], references: [profiles.id] }),
  history: many(appointmentHistory),
  photos: many(appointmentPhotos),
}));

export const appointmentHistoryRelations = relations(appointmentHistory, ({ one }) => ({
  appointment: one(appointments, { fields: [appointmentHistory.appointmentId], references: [appointments.id] }),
}));

export const appointmentPhotosRelations = relations(appointmentPhotos, ({ one }) => ({
  appointment: one(appointments, { fields: [appointmentPhotos.appointmentId], references: [appointments.id] }),
}));

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
export type AppointmentStatus = (typeof appointmentStatus.enumValues)[number];
export type Actor = { id: string; name: string; role: (typeof userRole.enumValues)[number] };
