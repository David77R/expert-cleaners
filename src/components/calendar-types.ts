import type { CalendarView } from "@/domain/calendar-view";
import type { getRange } from "@/server/appointments";
import type { Technician } from "@/db/schema";

export type CalendarAppointment = Awaited<ReturnType<typeof getRange>>["appointments"][number] & {
  kind?: "delivery";
};
export type CalendarTechnician = Pick<
  Technician,
  "id" | "name" | "color" | "zone" | "shiftStartMin" | "shiftEndMin" | "workDays"
>;
export type CalendarNav = { view: CalendarView; date: string; tech: string | null; entregas?: boolean };
