import Link from "next/link";
import { orderSummary } from "@/domain/appointment-items";
import { formatMinutes } from "@/domain/appointment-rules";
import { formatDayLabel } from "@/domain/calendar-view";
import { STAGE_KEYS, STAGE_LABELS, currentStage, hasDelivery } from "@/domain/delivery";
import { formatAddress, formatMoney } from "@/domain/invoice";
import { calendarHref } from "@/lib/calendar-links";
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import type { getCustomer } from "@/server/customers";

type Row = Awaited<ReturnType<typeof getCustomer>>["appointments"][number];

const TIME = new Intl.DateTimeFormat("es-US", {
  timeZone: "America/New_York",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const INVOICE_LABELS = { not_generated: "Sin factura", generated: "Factura generada", sent: "Factura enviada" };

const HEAD = "whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-soft";
const CELL = "px-3 py-3 align-top";

function orderItems(row: Row) {
  return row.items.length > 0 ? row.items : [{ service: row.service }];
}

function editHref(row: Row, returnHref?: string) {
  return `/appointments/${row.id}/edit${returnHref ? `?volver=${encodeURIComponent(returnHref)}` : ""}`;
}

function AppointmentCards({ rows, returnHref }: { rows: Row[]; returnHref?: string }) {
  return (
    <ul className="flex flex-col gap-2.5 md:hidden">
      {rows.map((row) => {
        const stage = currentStage(row.stages);
        return (
          <li key={row.id} className="rounded-md border border-hair bg-paper">
            <Link
              href={calendarHref({ view: "day", date: row.date, appt: row.id })}
              className="flex flex-col gap-2 px-3.5 py-3"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-semibold tabular-nums">{row.code}</span>
                <StatusBadge status={row.status} compact />
              </span>
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">
                  {formatDayLabel(row.date)} · <span className="tabular-nums">{formatMinutes(row.startMin)}</span>
                </span>
                <span className="font-display text-base font-semibold tabular-nums">{formatMoney(row.priceCents)}</span>
              </span>
              <span className="text-sm">
                {orderSummary(orderItems(row)).map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
              <span className="text-xs text-soft">{formatAddress(row.address)}</span>
              {hasDelivery(row) && (
                <span className="text-xs font-medium text-brand-ink">
                  Entrega: {formatDayLabel(row.deliveryDate)} {formatMinutes(row.deliveryStartMin)}
                  {row.deliveryTechnician ? ` · ${row.deliveryTechnician.name}` : ""}
                </span>
              )}
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className={`font-semibold ${row.paymentStatus === "paid" ? "text-success" : "text-attention"}`}>
                  {row.paymentStatus === "paid" ? "Pagado" : "Sin pagar"}
                </span>
                <span className="text-soft">{INVOICE_LABELS[row.invoiceStatus]}</span>
                {stage && row.status !== "cancelled" && (
                  <span className="font-medium text-success">{STAGE_LABELS[stage]}</span>
                )}
              </span>
            </Link>
            <div className="grid grid-cols-2 border-t border-hair text-sm font-semibold">
              <Link
                href={editHref(row, returnHref)}
                className="flex items-center justify-center gap-1.5 py-2.5 text-soft hover:bg-canvas hover:text-ink"
              >
                <Icon name="wrench" size={14} />
                Editar
              </Link>
              <Link
                href={calendarHref({ view: "day", date: row.date, appt: row.id })}
                className="flex items-center justify-center gap-1.5 border-l border-hair py-2.5 text-brand-ink hover:bg-brand-soft"
              >
                Ver en calendario
                <Icon name="right" size={14} />
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CustomerAppointmentsTable({ rows, returnHref }: { rows: Row[]; returnHref?: string }) {
  return (
    <>
      <AppointmentCards rows={rows} returnHref={returnHref} />
      <AppointmentTable rows={rows} returnHref={returnHref} />
    </>
  );
}

function AppointmentTable({ rows, returnHref }: { rows: Row[]; returnHref?: string }) {
  return (
    <div className="hidden overflow-x-auto rounded-md border border-hair bg-paper md:block">
      <table className="w-full min-w-[1080px] text-sm">
        <thead className="border-b border-hair bg-canvas/60">
          <tr>
            <th className={HEAD}>ID</th>
            <th className={HEAD}>Fecha</th>
            <th className={HEAD}>Listo en</th>
            <th className={HEAD}>Dirección</th>
            <th className={HEAD}>Pedido</th>
            <th className={HEAD}>Usuario</th>
            <th className={HEAD}>Estado</th>
            <th className={HEAD}>Notas</th>
            <th className={HEAD}>Pago</th>
            <th className={`${HEAD} text-right`}>Total</th>
            <th className={HEAD}>
              <span className="sr-only">Abrir</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hair">
          {rows.map((row) => {
            const stage = currentStage(row.stages);
            return (
              <tr key={row.id} className="transition-colors hover:bg-brand-soft/20">
                <td className={`${CELL} font-display whitespace-nowrap font-semibold tabular-nums`}>{row.code}</td>
                <td className={`${CELL} whitespace-nowrap`}>
                  <span className="block font-medium">{formatDayLabel(row.date)}</span>
                  <span className="block text-xs tabular-nums text-muted">{formatMinutes(row.startMin)}</span>
                </td>
                <td className={`${CELL} whitespace-nowrap`}>
                  {row.readyDate ? (
                    <span className="rounded-[3px] bg-info-soft px-1.5 py-0.5 text-xs font-medium text-info">
                      {formatDayLabel(row.readyDate)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className={`${CELL} max-w-56`}>
                  <span className="block">{formatAddress(row.address)}</span>
                  {row.destinationAddress && (
                    <span className="mt-1 block text-xs text-soft">
                      Entrega: {formatAddress(row.destinationAddress)}
                    </span>
                  )}
                </td>
                <td className={CELL}>
                  {orderSummary(orderItems(row)).map((line) => (
                    <span key={line} className="block whitespace-nowrap">
                      {line}
                    </span>
                  ))}
                </td>
                <td className={`${CELL} text-xs leading-relaxed`}>
                  <span className="block">
                    <span className="text-soft">Orden:</span> {row.agent.name} ({TIME.format(row.createdAt)})
                  </span>
                  {STAGE_KEYS.map((key) => {
                    const mark = row.stages[key];
                    return (
                      <span key={key} className="block">
                        <span className="text-soft">{STAGE_LABELS[key]}:</span>{" "}
                        {mark ? `${TIME.format(new Date(mark.at))} · ${mark.by}` : ""}
                      </span>
                    );
                  })}
                  {hasDelivery(row) && (
                    <span className="mt-1 block font-medium text-brand-ink">
                      Entrega: {formatDayLabel(row.deliveryDate)} {formatMinutes(row.deliveryStartMin)}
                      {row.deliveryTechnician ? ` · ${row.deliveryTechnician.name}` : ""}
                    </span>
                  )}
                </td>
                <td className={`${CELL} whitespace-nowrap`}>
                  <StatusBadge status={row.status} compact />
                  {stage && row.status !== "cancelled" && (
                    <span className="mt-1 block text-xs font-medium text-success">{STAGE_LABELS[stage]}</span>
                  )}
                </td>
                <td className={`${CELL} max-w-48`}>
                  {row.notes ? (
                    <span className="line-clamp-3 text-xs text-soft" title={row.notes}>
                      {row.notes}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className={`${CELL} whitespace-nowrap text-xs`}>
                  <span
                    className={`block font-semibold ${row.paymentStatus === "paid" ? "text-success" : "text-attention"}`}
                  >
                    {row.paymentStatus === "paid" ? "Pagado" : "Sin pagar"}
                  </span>
                  <span className="block text-soft">{INVOICE_LABELS[row.invoiceStatus]}</span>
                </td>
                <td className={`${CELL} font-display whitespace-nowrap text-right font-semibold tabular-nums`}>
                  {formatMoney(row.priceCents)}
                </td>
                <td className={CELL}>
                  <div className="flex items-center gap-0.5">
                    <Link
                      href={editHref(row, returnHref)}
                      aria-label={`Editar la cita ${row.code}`}
                      title="Editar cita"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-soft hover:bg-canvas hover:text-ink"
                    >
                      <Icon name="wrench" size={14} />
                    </Link>
                    <Link
                      href={calendarHref({ view: "day", date: row.date, appt: row.id })}
                      aria-label={`Abrir la cita ${row.code}`}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-brand-ink hover:bg-brand-soft"
                    >
                      <Icon name="right" />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
