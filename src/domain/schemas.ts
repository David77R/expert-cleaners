import { z } from "zod";
import { CANCEL_REASONS } from "./appointment-rules";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const minutes = z.number().int().min(0).max(1439);

export const addressSnapshotSchema = z.object({
  line1: z.string().trim().min(1),
  unit: z.string().trim().default(""),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  zip: z.string().trim().min(3),
  notes: z.string().trim().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const createCustomerSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().trim().min(7),
  email: z.email().optional(),
  notes: z.string().trim().optional(),
  allowMarketing: z.boolean().default(false),
  addresses: z.array(addressSnapshotSchema).min(1),
});

export const createAppointmentSchema = z.object({
  customerId: z.uuid(),
  addressId: z.uuid(),
  serviceId: z.uuid(),
  technicianId: z.uuid(),
  date: isoDate,
  startMin: minutes,
  durationMin: z.number().int().min(15).max(720),
  specs: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  notes: z.string().default(""),
  alerts: z
    .array(z.object({ key: z.string(), label: z.string(), level: z.enum(["attention", "warning", "info"]) }))
    .default([]),
  destinationAddress: addressSnapshotSchema.optional(),
  billingAddress: addressSnapshotSchema.optional(),
});

export const cancelSchema = z.object({
  reason: z.enum(CANCEL_REASONS),
  explanation: z.string().optional(),
});

export const rescheduleSchema = z.object({
  date: isoDate,
  startMin: minutes,
  technicianId: z.uuid().optional(),
  reason: z.string().trim().min(1, "El motivo es obligatorio"),
});

export const moveSchema = z.object({
  startMin: minutes,
  technicianId: z.uuid(),
});

export const dayQuerySchema = z.object({
  date: isoDate,
  technicianId: z.uuid().optional(),
});

export type CreateAppointmentInput = z.input<typeof createAppointmentSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
export type RescheduleInput = z.infer<typeof rescheduleSchema>;
