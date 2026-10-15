import type { AppointmentStatus } from "@/db/schema";

export const STATUS_FILTERS = {
  "por-confirmar": { key: "notConfirmed", label: "Por confirmar" },
  confirmadas: { key: "confirmed", label: "Confirmadas" },
  reprogramadas: { key: "rescheduled", label: "Reprogramadas" },
  completadas: { key: "completed", label: "Completadas" },
  conflicto: { key: "overlaps", label: "Con conflicto" },
  canceladas: { key: "cancelled", label: "Canceladas" },
} as const;

export type StatusFilter = keyof typeof STATUS_FILTERS;

const STATUS_OF: Partial<Record<StatusFilter, AppointmentStatus>> = {
  "por-confirmar": "not_confirmed",
  confirmadas: "confirmed",
  reprogramadas: "rescheduled",
  completadas: "completed",
  canceladas: "cancelled",
};

export function parseStatusFilter(raw: string | undefined | null): StatusFilter | null {
  return raw && raw in STATUS_FILTERS ? (raw as StatusFilter) : null;
}

export function filterForSummaryKey(key: string): StatusFilter | null {
  const found = Object.entries(STATUS_FILTERS).find(([, value]) => value.key === key);
  return found ? (found[0] as StatusFilter) : null;
}

export function matchesStatusFilter(
  appointment: { id: string; status: AppointmentStatus },
  filter: StatusFilter | null,
  overlapIds: ReadonlySet<string>,
): boolean {
  if (!filter) return true;
  if (filter === "conflicto") return overlapIds.has(appointment.id) && appointment.status !== "cancelled";
  return appointment.status === STATUS_OF[filter];
}
