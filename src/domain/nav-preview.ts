import type { AppointmentStatus } from "@/db/schema";
import type { AlertLevel, AlertType } from "@/domain/alert-rules";

export const NAV_PREVIEW_SECTIONS = ["today", "active", "alerts"] as const;

export type NavPreviewSection = (typeof NAV_PREVIEW_SECTIONS)[number];

export type PreviewAppointment = {
  id: string;
  code: string;
  customerName: string;
  serviceName: string;
  city: string;
  technicianName: string;
  technicianColor: string;
  startMin: number;
  durationMin: number;
  status: AppointmentStatus;
};

type DayPreview<S extends "today" | "active"> = {
  section: S;
  date: string;
  nowMin: number;
  appointments: PreviewAppointment[];
};

export type NavPreview =
  | DayPreview<"today">
  | DayPreview<"active">
  | {
      section: "alerts";
      date: string;
      total: number;
      groups: {
        type: AlertType;
        level: AlertLevel;
        count: number;
        appointments: { id: string; code: string; customerName: string; date: string; startMin: number }[];
      }[];
    };

export const ACTIVE_STATUSES: readonly AppointmentStatus[] = ["not_confirmed", "confirmed", "rescheduled"];

export function isNavPreviewSection(value: unknown): value is NavPreviewSection {
  return typeof value === "string" && (NAV_PREVIEW_SECTIONS as readonly string[]).includes(value);
}

export function isInProgress(appointment: Pick<PreviewAppointment, "startMin" | "durationMin">, nowMin: number) {
  return appointment.startMin <= nowMin && nowMin < appointment.startMin + appointment.durationMin;
}

export function splitActive(appointments: readonly PreviewAppointment[], nowMin: number) {
  const active = appointments.filter((appointment) => ACTIVE_STATUSES.includes(appointment.status));
  return {
    now: active.filter((appointment) => isInProgress(appointment, nowMin)),
    next: active.filter((appointment) => appointment.startMin > nowMin),
    late: active.filter((appointment) => appointment.startMin + appointment.durationMin <= nowMin),
  };
}
