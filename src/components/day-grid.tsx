import { serviceLabel } from "@/domain/appointment-items";
import { formatMinutes } from "@/domain/appointment-rules";
import { initialsOf, layoutSlots, offShiftRanges, readableOn } from "@/domain/calendar-view";
import { AppointmentTicket } from "@/components/appointment-ticket";
import { DragTicket } from "@/components/drag-ticket";
import { isDraggable } from "@/domain/drag-target";
import { entryKey } from "@/domain/delivery";
import { END_HOUR, HOUR_PX, START_HOUR, toPx } from "@/lib/day-grid";
import type { CalendarAppointment, CalendarNav, CalendarTechnician } from "@/components/calendar-types";

const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, index) => START_HOUR + index);
const GRID_HEIGHT = HOURS.length * HOUR_PX;

export function DayGrid({
  appointments,
  overlapIds,
  technicians,
  nav,
  selectedId,
  nowMin,
}: {
  appointments: CalendarAppointment[];
  overlapIds: string[];
  technicians: CalendarTechnician[];
  nav: CalendarNav;
  selectedId: string | null;
  nowMin: number | null;
}) {
  const overlap = new Set(overlapIds);
  const laneNames = technicians.map((technician) => ({ id: technician.id, name: technician.name }));
  const showNow = nowMin !== null && nowMin >= START_HOUR * 60 && nowMin <= END_HOUR * 60;

  return (
    <div className="overflow-x-auto rounded-md border border-hair bg-paper">
      <div
        className="grid min-w-[760px]"
        style={{ gridTemplateColumns: `76px repeat(${technicians.length}, minmax(0, 1fr))` }}
      >
        <div className="border-b border-hair" />
        {technicians.map((technician) => {
          const count = appointments.filter(
            (a) => a.technicianId === technician.id && a.status !== "cancelled" && a.kind !== "delivery",
          ).length;
          return (
            <div
              key={technician.id}
              className="flex items-center gap-3 border-b-[3px] border-l border-l-hair px-3.5 py-3"
              style={{ borderBottomColor: technician.color }}
            >
              <span
                className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-bold"
                style={{ backgroundColor: technician.color, color: readableOn(technician.color) }}
              >
                {initialsOf(technician.name)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-semibold">{technician.name}</span>
                <span className="truncate text-xs text-soft">{technician.zone}</span>
              </span>
              <span className="text-right leading-tight">
                <span className="font-display block text-xl font-semibold tabular-nums">{count}</span>
                <span className="block text-[11px] text-muted">{count === 1 ? "cita" : "citas"}</span>
              </span>
            </div>
          );
        })}

        <div className="relative" style={{ height: GRID_HEIGHT }}>
          {HOURS.slice(1)
            .filter((hour) => !showNow || Math.abs(nowMin - hour * 60) >= 15)
            .map((hour) => (
              <span
                key={hour}
                className="font-display absolute right-3 -translate-y-1/2 whitespace-nowrap text-xs font-medium tabular-nums text-muted"
                style={{ top: (hour - START_HOUR) * HOUR_PX }}
              >
                {formatMinutes(hour * 60)}
              </span>
            ))}
          {showNow && (
            <span
              className="font-display absolute right-1.5 z-20 -translate-y-1/2 rounded-[3px] bg-attention px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white"
              style={{ top: toPx(nowMin) }}
            >
              {formatMinutes(nowMin).replace(" ", "")}
            </span>
          )}
        </div>

        {technicians.map((technician) => {
          const own = appointments.filter((a) => a.technicianId === technician.id);
          const layout = layoutSlots(own.map((a) => ({ ...a, id: entryKey(a) })));
          const off = offShiftRanges(technician, nav.date, START_HOUR * 60, END_HOUR * 60);
          return (
            <div
              key={technician.id}
              data-lane={technician.id}
              className="relative border-l border-hair"
              style={{ height: GRID_HEIGHT }}
            >
              {off.map(([start, end]) => (
                <div
                  key={`${start}-${end}`}
                  aria-hidden="true"
                  className="hatch-light absolute inset-x-0 bg-canvas/70"
                  style={{ top: toPx(start), height: toPx(end) - toPx(start) }}
                />
              ))}
              {HOURS.map((hour) => (
                <div key={hour}>
                  <div
                    className="absolute inset-x-0 border-t border-hair"
                    style={{ top: (hour - START_HOUR) * HOUR_PX }}
                  />
                  <div
                    className="absolute inset-x-0 border-t border-dotted border-hair/80"
                    style={{ top: (hour - START_HOUR) * HOUR_PX + HOUR_PX / 2 }}
                  />
                </div>
              ))}
              {own.map((appointment) => {
                const key = entryKey(appointment);
                const { column, columns } = layout.get(key) ?? { column: 0, columns: 1 };
                const height = Math.max((appointment.durationMin / 60) * HOUR_PX - 3, 46);
                const detail = columns > 1 ? "minimal" : height >= 84 ? "full" : height >= 58 ? "medium" : "minimal";
                return (
                  <DragTicket
                    key={key}
                    appointmentId={appointment.id}
                    code={appointment.code}
                    serviceName={serviceLabel(appointment)}
                    startMin={appointment.startMin}
                    durationMin={appointment.durationMin}
                    technicianId={appointment.technicianId}
                    technicians={laneNames}
                    draggable={appointment.kind !== "delivery" && isDraggable(appointment.status)}
                    className="absolute z-10"
                    style={{
                      top: toPx(appointment.startMin) + 1,
                      height,
                      left: `calc(${(column / columns) * 100}% + 6px)`,
                      width: `calc(${100 / columns}% - 12px)`,
                    }}
                  >
                    <AppointmentTicket
                      appointment={appointment}
                      nav={nav}
                      conflicting={appointment.kind !== "delivery" && overlap.has(appointment.id)}
                      selected={appointment.id === selectedId}
                      detail={detail}
                      className="h-full w-full"
                    />
                  </DragTicket>
                );
              })}
              {showNow && (
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 z-20 h-0.5 bg-attention"
                  style={{ top: toPx(nowMin) }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
