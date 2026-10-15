import Link from "next/link";
import type { CSSProperties } from "react";
import { serviceBreakdown, serviceLabel } from "@/domain/appointment-items";
import { appointmentNeedsPickup } from "@/domain/pickup";
import { blocksOverlap, formatMinutes } from "@/domain/appointment-rules";
import { formatDuration, formatRange, initialsOf, readableOn } from "@/domain/calendar-view";
import { formatPhone } from "@/domain/customer-rules";
import { calendarHref } from "@/lib/calendar-links";
import { HoverHint } from "@/components/hover-hint";
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import type { CalendarAppointment, CalendarNav } from "@/components/calendar-types";

export type TicketDetail = "full" | "medium" | "minimal";

function conflictPartners(appointment: CalendarAppointment, peers: readonly CalendarAppointment[]) {
  return peers.filter(
    (peer) =>
      peer.id !== appointment.id &&
      peer.kind !== "delivery" &&
      peer.status !== "cancelled" &&
      peer.technicianId === appointment.technicianId &&
      peer.date === appointment.date &&
      blocksOverlap(peer, appointment),
  );
}

export function AppointmentTicket({
  appointment,
  nav,
  conflicting,
  selected,
  detail,
  peers = [],
  className = "",
  style,
}: {
  appointment: CalendarAppointment;
  nav: CalendarNav;
  conflicting: boolean;
  selected: boolean;
  detail: TicketDetail;
  peers?: readonly CalendarAppointment[];
  className?: string;
  style?: CSSProperties;
}) {
  const cancelled = appointment.status === "cancelled";
  const delivery = appointment.kind === "delivery";
  const color = appointment.technician.color;
  const ink = readableOn(color);
  const customer = `${appointment.customer.firstName} ${appointment.customer.lastName}`.trim();
  const lines = serviceBreakdown(appointment);
  const shownLines = detail === "full" ? lines.slice(0, 4) : lines.slice(0, 1);
  const hiddenLines = lines.length - shownLines.length;
  const partners = conflicting ? conflictPartners(appointment, peers) : [];
  const dashed = delivery;
  const unconfirmed = !delivery && appointment.status === "not_confirmed";
  const rugPickup = !delivery && appointmentNeedsPickup(appointment);

  const conflictHint = (
    <span className="flex flex-col gap-1">
      <span className="font-semibold">Conflicto de horario</span>
      <span>
        {appointment.technician.name} tiene otra cita a la misma hora
        {partners.length > 0 ? ":" : "."}
      </span>
      {partners.map((partner) => (
        <span key={partner.id} className="text-white/80">
          {partner.code} · {formatRange(partner.startMin, partner.durationMin)} · {serviceLabel(partner)}
        </span>
      ))}
      <span className="text-white/70">Ábrela para moverla o cambiar el técnico.</span>
    </span>
  );

  return (
    <Link
      href={calendarHref({ ...nav, appt: appointment.id })}
      scroll={false}
      draggable={false}
      aria-current={selected ? "true" : undefined}
      className={`group relative flex flex-col overflow-hidden rounded-md text-xs shadow-[0_1px_2px_rgba(18,24,31,0.08)] transition-shadow hover:shadow-md ${
        dashed ? "border-2 border-dashed" : "border"
      } ${unconfirmed ? "!border-2 !border-warning" : ""} ${conflicting ? "!border-2 !border-attention" : ""} ${cancelled ? "opacity-60" : ""} ${
        selected ? "ring-2 ring-ink ring-offset-1" : ""
      } ${className}`}
      style={{ ...style, backgroundColor: `${color}1f`, borderColor: conflicting ? undefined : `${color}99` }}
    >
      {(rugPickup || delivery) && (
        <span
          className={`flex shrink-0 items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${
            delivery ? "bg-success" : "bg-indigo"
          }`}
        >
          <Icon name={delivery ? "home" : "truck"} size={11} />
          {delivery ? "Alfombras · Entrega" : "Alfombras · Recogida"}
        </span>
      )}
      {unconfirmed && (
        <span className="flex shrink-0 items-center gap-1 bg-warning px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          <Icon name="clock" size={11} />
          Sin confirmar
        </span>
      )}
      <span
        className="flex shrink-0 items-center justify-between gap-1.5 px-2 py-1"
        style={{ backgroundColor: color, color: ink }}
      >
        <span className="font-display min-w-0 truncate whitespace-nowrap text-[12.5px] font-semibold tabular-nums">
          {detail === "minimal"
            ? formatMinutes(appointment.startMin)
            : formatRange(appointment.startMin, appointment.durationMin)}
          {detail !== "minimal" && (
            <span className="ml-1.5 font-sans text-[11px] font-medium opacity-80">
              {formatDuration(appointment.durationMin)}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {!delivery && (appointment.address.lat == null || appointment.address.lng == null) && (
            <HoverHint
              hint={
                <span className="flex flex-col gap-1">
                  <span className="font-semibold">Dirección sin ubicar</span>
                  <span>No aparece en el mapa. Abre la cita y corrige la dirección.</span>
                </span>
              }
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-attention text-white shadow-sm">
                <Icon name="pin" size={12} />
                <span className="sr-only">Dirección sin ubicar</span>
              </span>
            </HoverHint>
          )}
          {conflicting && (
            <HoverHint hint={conflictHint}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-attention shadow-sm">
                <Icon name="alert" size={12} />
                <span className="sr-only">Conflicto de horario</span>
              </span>
            </HoverHint>
          )}
        </span>
      </span>

      <span className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden px-2 py-1.5 text-ink [&>*]:shrink-0">
        <span className={`block truncate text-[12.5px] font-semibold ${cancelled ? "line-through" : ""}`}>
          {customer || "Sin nombre"}
        </span>
        {detail !== "minimal" && (
          <span className="flex items-center gap-1.5 truncate text-soft">
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-[8px] font-bold"
              style={{ backgroundColor: color, color: ink }}
            >
              {initialsOf(appointment.technician.name)}
            </span>
            <span className="truncate">{appointment.technician.name}</span>
            {detail === "full" && appointment.customer.phone && (
              <span className="truncate tabular-nums">· {formatPhone(appointment.customer.phone)}</span>
            )}
          </span>
        )}
        <span className="mt-0.5 flex flex-col">
          {shownLines.map((line) => (
            <span key={line.name} className="flex items-baseline justify-between gap-2">
              <span className={`truncate font-medium ${cancelled ? "line-through" : ""}`}>
                {line.name}
                {line.count > 1 && <span className="ml-1 font-semibold">x{line.count}</span>}
              </span>
              {detail !== "minimal" && line.minutes > 0 && (
                <span className="shrink-0 tabular-nums text-soft">{formatDuration(line.minutes)}</span>
              )}
            </span>
          ))}
          {hiddenLines > 0 && <span className="text-soft">+{hiddenLines} más</span>}
        </span>
        {detail === "full" && (
          <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
            <StatusBadge status={appointment.status} compact />
            <span className="font-display text-[11px] tabular-nums text-muted">{appointment.code}</span>
          </span>
        )}
      </span>
    </Link>
  );
}
