import Link from "next/link";
import { WEEKDAY_LONG, weekDates, weekdayIndex } from "@/domain/calendar-view";
import { entryKey } from "@/domain/delivery";
import { calendarHref } from "@/lib/calendar-links";
import { AppointmentTicket } from "@/components/appointment-ticket";
import { Icon } from "@/components/icons";
import type { CalendarAppointment, CalendarNav } from "@/components/calendar-types";

const MAX_PER_DAY = 6;

export function WeekView({
  nav,
  today,
  appointments,
  overlapIds,
  selectedId,
}: {
  nav: CalendarNav;
  today: string;
  appointments: CalendarAppointment[];
  overlapIds: string[];
  selectedId: string | null;
}) {
  const overlap = new Set(overlapIds);
  const dates = weekDates(nav.date);

  return (
    <div className="grid grid-cols-1 divide-y divide-hair overflow-hidden rounded-md border border-hair bg-paper md:grid-cols-2 md:divide-y-0 lg:grid-cols-7 lg:divide-x">
      {dates.map((date) => {
        const dayAppointments = appointments.filter((a) => a.date === date).sort((a, b) => a.startMin - b.startMin);
        const active = dayAppointments.filter((a) => a.status !== "cancelled" && a.kind !== "delivery").length;
        const isToday = date === today;
        const hasOverlap = dayAppointments.some((a) => overlap.has(a.id));
        const visible = dayAppointments.slice(0, MAX_PER_DAY);
        const hidden = dayAppointments.length - visible.length;
        const dayHref = calendarHref({ view: "day", date, tech: nav.tech, entregas: nav.entregas });
        const weekday = WEEKDAY_LONG[weekdayIndex(date)];

        return (
          <section
            key={date}
            aria-label={`${weekday} ${Number(date.slice(8, 10))}`}
            className={`flex min-h-0 min-w-0 flex-col gap-2.5 p-2.5 md:min-h-40 md:border-b md:border-hair lg:min-h-[28rem] lg:border-b-0 ${
              isToday ? "bg-brand-soft/40" : ""
            }`}
          >
            <Link
              href={dayHref}
              className={`-mx-2.5 -mt-2.5 flex items-end justify-between gap-2 border-t-[3px] px-3 pb-1 pt-2.5 ${
                isToday ? "border-brand" : "border-transparent"
              }`}
            >
              <span className="flex items-baseline gap-2">
                <span
                  className={`font-display text-lg font-semibold leading-none tabular-nums ${
                    isToday ? "text-brand-ink" : "text-ink"
                  }`}
                >
                  {Number(date.slice(8, 10))}
                </span>
                <span className="text-sm text-soft">{weekday}</span>
              </span>
              <span className="flex items-center gap-1.5 pb-0.5">
                {hasOverlap && (
                  <span className="text-attention" title="Hay citas en conflicto">
                    <Icon name="alert" size={14} />
                    <span className="sr-only">Hay citas en conflicto</span>
                  </span>
                )}
                {active > 0 && (
                  <span className="font-display text-sm font-semibold tabular-nums text-soft">{active}</span>
                )}
              </span>
            </Link>

            {dayAppointments.length === 0 ? (
              <p className="px-1 pt-2 text-xs text-muted">Sin citas</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {visible.map((appointment) => (
                  <li key={entryKey(appointment)}>
                    <AppointmentTicket
                      appointment={appointment}
                      nav={nav}
                      conflicting={appointment.kind !== "delivery" && overlap.has(appointment.id)}
                      selected={appointment.id === selectedId}
                      detail="full"
                      peers={dayAppointments}
                    />
                  </li>
                ))}
              </ul>
            )}

            {hidden > 0 && (
              <Link href={dayHref} className="px-1 text-xs font-semibold text-brand-ink hover:underline">
                Ver {hidden} más en el día
              </Link>
            )}
          </section>
        );
      })}
    </div>
  );
}
