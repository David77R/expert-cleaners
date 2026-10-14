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

export function CustomerAppointmentsTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-hair bg-paper">
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
                  <Link
                    href={calendarHref({ view: "day", date: row.date, appt: row.id })}
                    aria-label={`Abrir la cita ${row.code}`}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-brand-ink hover:bg-brand-soft"
                  >
                    <Icon name="right" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
