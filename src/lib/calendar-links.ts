import type { CalendarView } from "@/domain/calendar-view";

export function calendarHref(options: {
  view?: CalendarView;
  date?: string;
  tech?: string | null;
  appt?: string | null;
  mapa?: boolean;
  entregas?: boolean;
  estado?: string | null;
}): string {
  const params = new URLSearchParams();
  if (options.view && options.view !== "day") params.set("view", options.view);
  if (options.date) params.set("date", options.date);
  if (options.tech) params.set("tech", options.tech);
  if (options.appt) params.set("appt", options.appt);
  if (options.mapa) params.set("mapa", "1");
  if (options.entregas === false) params.set("entregas", "0");
  if (options.estado) params.set("estado", options.estado);
  const query = params.toString();
  return query ? `/calendar?${query}` : "/calendar";
}
