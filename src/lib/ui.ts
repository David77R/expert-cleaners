import type { AppointmentStatus } from "@/db/schema";

export const STATUS_UI: Record<AppointmentStatus, { label: string; badge: string; dot: string }> = {
  not_confirmed: { label: "No confirmada", badge: "bg-warning-soft text-warning", dot: "bg-warning" },
  confirmed: { label: "Confirmada", badge: "bg-success-soft text-success", dot: "bg-success" },
  rescheduled: { label: "Reprogramada", badge: "bg-info-soft text-info", dot: "bg-info" },
  cancelled: { label: "Cancelada", badge: "bg-neutral-soft text-muted", dot: "bg-muted" },
  completed: { label: "Completada", badge: "bg-brand-soft text-brand-ink", dot: "bg-brand" },
};

export const TICKET_UI: Record<AppointmentStatus, string> = {
  not_confirmed: "border-dashed border-warning/70 bg-paper",
  confirmed: "border-solid border-hair bg-paper",
  rescheduled: "border-solid border-info/40 bg-info-soft/70",
  completed: "border-solid border-brand/40 bg-brand-soft/70",
  cancelled: "border-solid border-hair bg-paper hatch opacity-70",
};

export const AVATAR_CLASSES = [
  "bg-brand-soft text-brand-ink",
  "bg-indigo-soft text-indigo",
  "bg-warning-soft text-warning",
  "bg-success-soft text-success",
  "bg-attention-soft text-attention",
  "bg-info-soft text-info",
] as const;
