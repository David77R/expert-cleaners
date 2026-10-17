import { serviceLabel } from "@/domain/appointment-items";
import { formatMinutes } from "@/domain/appointment-rules";
import { initialsOf, layoutSlots, offShiftRanges, readableOn } from "@/domain/calendar-view";
import { AppointmentTicket } from "@/components/appointment-ticket";
import { DragTicket } from "@/components/drag-ticket";
import { isDraggable } from "@/domain/drag-target";
import { entryKey } from "@/domain/delivery";
import { HOUR_PX, gridHours, toPx as baseToPx } from "@/lib/day-grid";
import type { CalendarAppointment, CalendarNav, CalendarTechnician } from "@/components/calendar-types";

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
  const { startHour, endHour } = gridHours(appointments);
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const gridHeight = hours.length * HOUR_PX;
  const toPx = (min: number) => baseToPx(min, startHour);
  const laneNames = technicians.map((technician) => ({ id: technician.id, name: technician.name }));
  const showNow = nowMin !== null && nowMin >= startHour * 60 && nowMin <= endHour * 60;

  return (
    <div data-grid-scroll className="overflow-x-auto rounded-md border border-hair bg-paper">
      <div
        className="grid [--lane:12.5rem] [--time:62px] md:min-w-[760px] md:[--lane:0px] md:[--time:76px]"
        style={{ gridTemplateColumns: `var(--time) repeat(${technicians.length}, minmax(var(--lane), 1fr))` }}
      >
        <div className="sticky left-0 z-[25] border-b border-hair bg-paper" />
        {technicians.map((technician) => {
          const count = appointments.filter(
            (a) => a.technicianId === technician.id && a.status !== "cancelled" && a.kind !== "delivery",
          ).length;
          return (
            <div
              key={technician.id}
              className="flex min-w-0 items-center gap-2 border-b-[3px] border-l border-l-hair px-2.5 py-2.5 md:gap-3 md:px-3.5 md:py-3"
              style={{ borderBottomColor: technician.color }}
            >
              <span
                className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold md:h-9 md:w-9 md:text-sm"
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

        <div
          className="sticky left-0 z-[25] border-r border-hair bg-paper md:border-r-0"
          style={{ height: gridHeight }}
        >
          {hours
            .slice(1)
            .filter((hour) => !showNow || Math.abs(nowMin - hour * 60) >= 15)
            .map((hour) => (
              <span
                key={hour}
                className="font-display absolute right-2 -translate-y-1/2 whitespace-nowrap text-[11px] font-medium tabular-nums text-muted md:right-3 md:text-xs"
                style={{ top: (hour - startHour) * HOUR_PX }}
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
          const off = offShiftRanges(technician, nav.date, startHour * 60, endHour * 60);
          return (
            <div
              key={technician.id}
              data-lane={technician.id}
              className="relative border-l border-hair"
              style={{ height: gridHeight }}
            >
              {off.map(([start, end]) => (
                <div
                  key={`${start}-${end}`}
                  aria-hidden="true"
                  className="hatch-light absolute inset-x-0 bg-canvas/70"
                  style={{ top: toPx(start), height: toPx(end) - toPx(start) }}
                />
              ))}
              {hours.map((hour) => (
                <div key={hour}>
                  <div
                    className="absolute inset-x-0 border-t border-hair"
                    style={{ top: (hour - startHour) * HOUR_PX }}
                  />
                  <div
                    className="absolute inset-x-0 border-t border-dotted border-hair/80"
                    style={{ top: (hour - startHour) * HOUR_PX + HOUR_PX / 2 }}
                  />
                </div>
              ))}
              {own.map((appointment) => {
                const key = entryKey(appointment);
                const { column, columns } = layout.get(key) ?? { column: 0, columns: 1 };
                const height = Math.max((appointment.durationMin / 60) * HOUR_PX - 3, 52);
                const detail = height >= 120 ? "full" : height >= 70 ? "medium" : "minimal";
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
                    startHour={startHour}
                    endHour={endHour}
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
                      peers={appointments}
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
