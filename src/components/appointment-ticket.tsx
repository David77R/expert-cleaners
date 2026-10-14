import Link from "next/link";
import type { CSSProperties } from "react";
import { serviceLabel } from "@/domain/appointment-items";
import { formatMinutes } from "@/domain/appointment-rules";
import { formatRange } from "@/domain/calendar-view";
import { calendarHref } from "@/lib/calendar-links";
import { TICKET_UI } from "@/lib/ui";
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import type { CalendarAppointment, CalendarNav } from "@/components/calendar-types";

export type TicketDetail = "full" | "medium" | "minimal";

export function AppointmentTicket({
  appointment,
  nav,
  conflicting,
  selected,
  detail,
  className = "",
  style,
}: {
  appointment: CalendarAppointment;
  nav: CalendarNav;
  conflicting: boolean;
  selected: boolean;
  detail: TicketDetail;
  className?: string;
  style?: CSSProperties;
}) {
  const cancelled = appointment.status === "cancelled";
  const customer = `${appointment.customer.firstName} ${appointment.customer.lastName}`;

  return (
    <Link
      href={calendarHref({ ...nav, appt: appointment.id })}
      scroll={false}
      draggable={false}
      aria-current={selected ? "true" : undefined}
      className={`group relative block overflow-hidden rounded-md border py-1.5 pl-4 pr-2.5 text-xs shadow-[0_1px_0_rgba(18,24,31,0.05)] transition-shadow hover:shadow-md ${
        TICKET_UI[appointment.status]
      } ${conflicting ? "!border-attention !border-solid" : ""} ${selected ? "ring-2 ring-brand ring-offset-1" : ""} ${className}`}
      style={style}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[6px]"
        style={{ backgroundColor: appointment.technician.color }}
      />
      <span className="flex items-center justify-between gap-2">
        <span className="font-display whitespace-nowrap text-[13px] font-semibold tabular-nums">
          {detail === "minimal"
            ? formatMinutes(appointment.startMin)
            : formatRange(appointment.startMin, appointment.durationMin)}
        </span>
        {conflicting && (
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-attention">
            <Icon name="alert" size={12} />
            <span className={detail === "minimal" ? "sr-only" : ""}>Solape</span>
          </span>
        )}
      </span>
      <span className={`block truncate font-semibold ${cancelled ? "line-through" : ""}`}>
        {serviceLabel(appointment)}
      </span>
      {detail !== "minimal" && <span className="block truncate text-soft">{customer}</span>}
      {detail === "full" && (
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge status={appointment.status} compact />
          <span className="font-display text-[11px] tabular-nums text-muted">{appointment.code}</span>
        </span>
      )}
    </Link>
  );
}
