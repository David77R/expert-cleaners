import Link from "next/link";
import { serviceLabel } from "@/domain/appointment-items";
import { WEEKDAY_SHORT, isInSameMonth, monthWeeks } from "@/domain/calendar-view";
import { formatMinutes } from "@/domain/appointment-rules";
import { entryKey } from "@/domain/delivery";
import { calendarHref } from "@/lib/calendar-links";
import { Icon } from "@/components/icons";
import type { CalendarAppointment, CalendarNav } from "@/components/calendar-types";

const MAX_CHIPS = 3;
const MAX_DOTS = 5;

function shortTime(min: number): string {
  return formatMinutes(min).replace(":00", "").replace(" ", "").toLowerCase();
}

export function MonthView({
  nav,
  today,
  appointments,
  overlapIds,
}: {
  nav: CalendarNav;
  today: string;
  appointments: CalendarAppointment[];
  overlapIds: string[];
}) {
  const overlap = new Set(overlapIds);
  const anchor = nav.date;
  const tech = nav.tech;
  const weeks = monthWeeks(anchor);
  const byDate = new Map<string, CalendarAppointment[]>();
  for (const appointment of appointments) {
    if (appointment.status === "cancelled") continue;
    byDate.set(appointment.date, [...(byDate.get(appointment.date) ?? []), appointment]);
  }
  for (const list of byDate.values()) list.sort((a, b) => a.startMin - b.startMin);

  return (
    <div className="overflow-hidden rounded-md border border-hair bg-paper">
      <div className="grid grid-cols-7 border-b border-hair bg-canvas">
        {WEEKDAY_SHORT.map((weekday) => (
          <div key={weekday} className="px-2 py-2.5 text-center text-xs font-semibold text-soft">
            {weekday}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((date, index) => {
          const items = byDate.get(date) ?? [];
          const inMonth = isInSameMonth(date, anchor);
          const isToday = date === today;
          const hasOverlap = items.some((a) => overlap.has(a.id));
          const chips = items.slice(0, MAX_CHIPS);
          const extra = items.length - chips.length;
          const colors = [...new Set(items.map((a) => a.technician.color))].slice(0, MAX_DOTS);

          return (
            <Link
              key={date}
              href={calendarHref({ view: "day", date, tech, entregas: nav.entregas })}
              aria-label={`${Number(date.slice(8, 10))}: ${items.length} citas`}
              className={`flex min-h-[78px] min-w-0 flex-col gap-1 border-hair p-1.5 transition-colors hover:bg-brand-soft/50 sm:min-h-[116px] sm:p-2 ${
                index % 7 !== 6 ? "border-r" : ""
              } ${index < weeks.length * 7 - 7 ? "border-b" : ""} ${inMonth ? "" : "bg-canvas/50"}`}
            >
              <span className="flex items-center justify-between gap-1">
                <span
                  className={`font-display flex h-7 min-w-7 items-center justify-center rounded-[4px] px-1 text-sm font-semibold tabular-nums ${
                    isToday ? "bg-brand text-white" : inMonth ? "text-ink" : "text-muted/70"
                  }`}
                >
                  {Number(date.slice(8, 10))}
                </span>
                <span className="flex items-center gap-1">
                  {hasOverlap && (
                    <span className="text-attention" title="Hay citas que se solapan">
                      <Icon name="alert" size={12} />
                      <span className="sr-only">Hay citas que se solapan</span>
                    </span>
                  )}
                  {items.length > 0 && (
                    <span className="font-display hidden text-xs font-semibold tabular-nums text-soft sm:inline">
                      {items.length}
                    </span>
                  )}
                </span>
              </span>

              {items.length > 0 && (
                <>
                  <span className="mt-auto flex flex-wrap gap-1 sm:hidden">
                    {colors.map((color) => (
                      <span key={color} className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                    {chips.map((appointment) => (
                      <span
                        key={entryKey(appointment)}
                        className={`truncate rounded-[3px] border-l-[4px] px-1.5 py-0.5 text-[11px] leading-tight text-ink ${
                          appointment.kind === "delivery" ? "border border-dashed border-brand/50 border-l-[4px]" : ""
                        }`}
                        style={{
                          borderLeftColor: appointment.technician.color,
                          backgroundColor: `${appointment.technician.color}1f`,
                        }}
                      >
                        <span className="font-semibold tabular-nums">{shortTime(appointment.startMin)}</span>{" "}
                        {appointment.kind === "delivery" && (
                          <span className="font-semibold text-brand-ink">Entrega · </span>
                        )}
                        {serviceLabel(appointment)}
                      </span>
                    ))}
                    {extra > 0 && <span className="px-1 text-[11px] font-medium text-brand-ink">+{extra} más</span>}
                  </span>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
