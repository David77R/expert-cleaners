export const STAGE_KEYS = ["pickedUp", "cleaned", "delivered"] as const;
export type StageKey = (typeof STAGE_KEYS)[number];
export type StageMark = { at: string; by: string };
export type AppointmentStages = Partial<Record<StageKey, StageMark>>;

export const STAGE_LABELS: Record<StageKey, string> = {
  pickedUp: "Recogido",
  cleaned: "Limpiado",
  delivered: "Entregado",
};

export const DELIVERY_SUFFIX = ":entrega";

export function isStageKey(value: unknown): value is StageKey {
  return typeof value === "string" && (STAGE_KEYS as readonly string[]).includes(value);
}

export function currentStage(stages: AppointmentStages): StageKey | null {
  for (const key of [...STAGE_KEYS].reverse()) {
    if (stages[key]) return key;
  }
  return null;
}

export type DeliveryFields = {
  id: string;
  deliveryDate: string | null;
  deliveryStartMin: number | null;
  deliveryDurationMin: number | null;
  deliveryTechnicianId: string | null;
};

export function hasDelivery<T extends DeliveryFields>(
  appointment: T,
): appointment is T & {
  deliveryDate: string;
  deliveryStartMin: number;
  deliveryDurationMin: number;
  deliveryTechnicianId: string;
} {
  return (
    appointment.deliveryDate != null &&
    appointment.deliveryStartMin != null &&
    appointment.deliveryDurationMin != null &&
    appointment.deliveryTechnicianId != null
  );
}

export function deliveryKey(id: string): string {
  return `${id}${DELIVERY_SUFFIX}`;
}

export function appointmentIdFromKey(key: string): string {
  return key.endsWith(DELIVERY_SUFFIX) ? key.slice(0, -DELIVERY_SUFFIX.length) : key;
}

export function asDeliveryEntry<
  T extends DeliveryFields & { date: string; startMin: number; durationMin: number; technicianId: string },
  Tech,
>(appointment: T & { technician: Tech; deliveryTechnician: Tech | null }): (T & { kind: "delivery" }) | null {
  if (!hasDelivery(appointment) || !appointment.deliveryTechnician) return null;
  return {
    ...appointment,
    kind: "delivery",
    date: appointment.deliveryDate,
    startMin: appointment.deliveryStartMin,
    durationMin: appointment.deliveryDurationMin,
    technicianId: appointment.deliveryTechnicianId,
    technician: appointment.deliveryTechnician,
  };
}

export function entryKey(entry: { id: string; kind?: "delivery" }): string {
  return entry.kind === "delivery" ? deliveryKey(entry.id) : entry.id;
}
