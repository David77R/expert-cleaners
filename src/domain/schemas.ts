import { z } from "zod";
import { MAX_ITEMS } from "./appointment-items";
import { CANCEL_REASONS } from "./appointment-rules";
import { isValidPhone } from "./customer-rules";
import { daysBetween, isRealDate, periodBounds } from "./date-rules";
import { SLUG_PATTERN } from "./service-rules";

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .refine(isRealDate, "Fecha inválida");
export const MAX_RANGE_DAYS = 42;
const minutes = z.number().int().min(0).max(1439);
const phoneField = z.string().trim().refine(isValidPhone, "Teléfono inválido");
const emailField = z.string().trim().toLowerCase().pipe(z.email());

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
  phone: phoneField,
  email: emailField.optional(),
  notes: z.string().trim().optional(),
  allowMarketing: z.boolean().default(false),
  addresses: z.array(addressSnapshotSchema).min(1),
});

export const updateCustomerSchema = z
  .object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    phone: phoneField.optional(),
    email: emailField.nullable().optional(),
    notes: z.string().trim().nullable().optional(),
    allowMarketing: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), "Envía al menos un campo");

export const updateAddressSchema = z
  .object({
    line1: z.string().trim().min(1).optional(),
    unit: z.string().trim().optional(),
    city: z.string().trim().min(1).optional(),
    state: z.string().trim().min(1).optional(),
    zip: z.string().trim().min(3).optional(),
    notes: z.string().trim().nullable().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), "Envía al menos un campo");

export const customerSearchSchema = z.object({
  q: z.string().trim().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const customerNoteSchema = z.object({
  text: z.string().trim().min(1, "La nota no puede estar vacía").max(2000),
});

const serviceFieldSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/, "La clave debe empezar en minúscula y no tener espacios"),
    label: z.string().trim().min(1),
    type: z.enum(["number", "select"]),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1)).optional(),
  })
  .superRefine((field, ctx) => {
    const options = field.options ?? [];
    if (field.type === "select" && options.length === 0) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Un campo de selección necesita opciones" });
    }
    if (field.type === "number" && options.length > 0) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Un campo numérico no usa opciones" });
    }
    if (new Set(options).size !== options.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Las opciones no pueden repetirse" });
    }
  });

const serviceFieldsSchema = z
  .array(serviceFieldSchema)
  .max(20)
  .refine(
    (fields) => new Set(fields.map((f) => f.key)).size === fields.length,
    "Las claves de campo no pueden repetirse",
  );

const basePrice = z.number().int().min(0).max(10_000_000);
const serviceDuration = z.number().int().min(15).max(720);

export const createServiceSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().regex(SLUG_PATTERN, "Slug inválido").optional(),
  category: z.string().trim().min(1),
  description: z.string().trim().optional(),
  basePriceCents: basePrice,
  durationMin: serviceDuration,
  twoAddresses: z.boolean().default(false),
  internalNotes: z.string().trim().optional(),
  detailedSpecs: z.string().trim().optional(),
  fields: serviceFieldsSchema.default([]),
});

export const updateServiceSchema = z
  .strictObject({
    name: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    description: z.string().trim().nullable().optional(),
    basePriceCents: basePrice.optional(),
    durationMin: serviceDuration.optional(),
    active: z.boolean().optional(),
    twoAddresses: z.boolean().optional(),
    internalNotes: z.string().trim().nullable().optional(),
    detailedSpecs: z.string().trim().nullable().optional(),
    fields: serviceFieldsSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), "Envía al menos un campo");

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido");
const workDays = z
  .array(z.number().int().min(0).max(6))
  .min(1, "Elige al menos un día")
  .transform((days) => [...new Set(days)].sort((a, b) => a - b));

const technicianShape = {
  name: z.string().trim().min(1).max(80),
  zone: z.string().trim().min(1).max(80),
  color: hexColor,
  workDays,
  shiftStartMin: minutes,
  shiftEndMin: minutes,
};

export const createTechnicianSchema = z
  .object(technicianShape)
  .refine((value) => value.shiftEndMin > value.shiftStartMin, {
    message: "La hora de salida debe ser después de la de entrada",
    path: ["shiftEndMin"],
  });

export const updateTechnicianSchema = z
  .object({ ...technicianShape, active: z.boolean() })
  .refine((value) => value.shiftEndMin > value.shiftStartMin, {
    message: "La hora de salida debe ser después de la de entrada",
    path: ["shiftEndMin"],
  });

export const AGENT_PASSWORD_MIN = 8;
const agentName = z.string().trim().min(1).max(80);
const agentEmail = z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido"));
const agentPassword = z
  .string()
  .min(AGENT_PASSWORD_MIN, `La contraseña debe tener al menos ${AGENT_PASSWORD_MIN} caracteres`)
  .max(72);

export const createAgentSchema = z.object({ name: agentName, email: agentEmail, password: agentPassword });

export const updateAgentSchema = z.object({
  name: agentName,
  email: agentEmail,
  password: agentPassword.optional(),
  active: z.boolean(),
});

export const serviceListSchema = z.object({
  includeInactive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(false),
});

const specsSchema = z.record(z.string(), z.union([z.string(), z.number()]));

export const appointmentItemSchema = z.object({
  serviceId: z.uuid("Elige un servicio"),
  specs: specsSchema.default({}),
  priceCents: z.number().int().min(0, "El precio no puede ser negativo").max(10_000_000).optional(),
});

const itemsSchema = z
  .array(appointmentItemSchema)
  .min(1, "Agrega al menos un servicio")
  .max(MAX_ITEMS, `Máximo ${MAX_ITEMS} servicios por cita`);

export const createAppointmentSchema = z.object({
  customerId: z.uuid(),
  addressId: z.uuid(),
  serviceId: z.uuid().optional(),
  items: itemsSchema.optional(),
  technicianId: z.uuid(),
  date: isoDate,
  startMin: minutes,
  durationMin: z.number().int().min(15).max(720),
  specs: specsSchema.default({}),
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

export const setAddressSchema = z.object({ addressId: z.uuid("Elige una dirección") });

export const updateItemsSchema = z.object({
  items: itemsSchema,
  durationMin: z.number().int().min(15).max(720).optional(),
  destinationAddress: addressSnapshotSchema.optional(),
});

export const moveSchema = z.object({
  startMin: minutes,
  technicianId: z.uuid(),
});

export const dayQuerySchema = z.object({
  date: isoDate,
  technicianId: z.uuid().optional(),
});

export const rangeQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    technicianId: z.uuid().optional(),
  })
  .refine((value) => value.from <= value.to, { path: ["to"], message: "La fecha final no puede ser anterior" })
  .refine((value) => daysBetween(value.from, value.to) < MAX_RANGE_DAYS, {
    path: ["to"],
    message: `El rango no puede superar ${MAX_RANGE_DAYS} días`,
  });

export const alertsQuerySchema = z.object({ date: isoDate.optional() });

export const routePointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const routePreviewSchema = z.object({
  points: z.array(routePointSchema).min(2),
});

export const routeDraftSaveSchema = z.object({
  date: isoDate,
  mode: z.enum(["tech", "service"]),
  groupKey: z.string().trim().min(1),
  stopIds: z.array(z.uuid()).min(2),
});

export const routeDraftDeleteSchema = z.object({
  date: isoDate,
  mode: z.enum(["tech", "service"]),
  groupKey: z.string().trim().min(1),
});

export const MAX_REPORT_DAYS = 93;

export const reportQuerySchema = z
  .object({
    period: z.enum(["day", "week", "month"]).optional(),
    date: isoDate.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    agentId: z.uuid().optional(),
  })
  .transform((value, ctx) => {
    let from: string;
    let to: string;
    if (value.period) {
      if (!value.date) {
        ctx.addIssue({ code: "custom", path: ["date"], message: "Indica la fecha de referencia" });
        return z.NEVER;
      }
      ({ from, to } = periodBounds(value.period, value.date));
    } else if (value.from && value.to) {
      ({ from, to } = value);
    } else {
      ctx.addIssue({ code: "custom", message: "Indica period y date, o from y to" });
      return z.NEVER;
    }
    if (from > to) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "La fecha final no puede ser anterior" });
      return z.NEVER;
    }
    if (daysBetween(from, to) >= MAX_REPORT_DAYS) {
      ctx.addIssue({ code: "custom", path: ["to"], message: `El rango no puede superar ${MAX_REPORT_DAYS} días` });
      return z.NEVER;
    }
    return { from, to, agentId: value.agentId };
  });

export type CreateAppointmentInput = z.input<typeof createAppointmentSchema>;
export type CreateCustomerInput = z.input<typeof createCustomerSchema>;
export type CreateServiceInput = z.input<typeof createServiceSchema>;
export type CreateTechnicianInput = z.input<typeof createTechnicianSchema>;
export type UpdateTechnicianInput = z.input<typeof updateTechnicianSchema>;
export type CreateAgentInput = z.input<typeof createAgentSchema>;
export type UpdateAgentInput = z.input<typeof updateAgentSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
export type RescheduleInput = z.infer<typeof rescheduleSchema>;
export type UpdateItemsInput = z.input<typeof updateItemsSchema>;
