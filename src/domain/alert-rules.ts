import type { AppointmentStatus } from "@/db/schema";

export type AlertType = "not_confirmed" | "overlap" | "completed_unpaid" | "rescheduled";
export type AlertLevel = "attention" | "warning" | "info";

export type AlertItem = {
  type: AlertType;
  level: AlertLevel;
  count: number;
  appointmentIds: string[];
};

type DayAppointment = { id: string; status: AppointmentStatus };

type AlertInput = {
  dayAppointments: readonly DayAppointment[];
  overlapIds: readonly string[];
  unpaidCompletedIds: readonly string[];
};

export function buildAlerts(input: AlertInput): AlertItem[] {
  const overlapSet = new Set(input.overlapIds);
  const groups: { type: AlertType; level: AlertLevel; ids: string[] }[] = [
    {
      type: "not_confirmed",
      level: "warning",
      ids: input.dayAppointments.filter((a) => a.status === "not_confirmed").map((a) => a.id),
    },
    {
      type: "overlap",
      level: "attention",
      ids: input.dayAppointments.filter((a) => overlapSet.has(a.id)).map((a) => a.id),
    },
    { type: "completed_unpaid", level: "attention", ids: [...input.unpaidCompletedIds] },
    {
      type: "rescheduled",
      level: "info",
      ids: input.dayAppointments.filter((a) => a.status === "rescheduled").map((a) => a.id),
    },
  ];

  return groups
    .filter((group) => group.ids.length > 0)
    .map((group) => ({ type: group.type, level: group.level, count: group.ids.length, appointmentIds: group.ids }));
}
