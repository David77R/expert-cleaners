import type { CalendarView } from "@/domain/calendar-view";

export function calendarHref(options: {
  view?: CalendarView;
  date?: string;
  tech?: string | null;
  appt?: string | null;
}): string {
  const params = new URLSearchParams();
  if (options.view && options.view !== "day") params.set("view", options.view);
  if (options.date) params.set("date", options.date);
  if (options.tech) params.set("tech", options.tech);
  if (options.appt) params.set("appt", options.appt);
  const query = params.toString();
  return query ? `/calendar?${query}` : "/calendar";
}
