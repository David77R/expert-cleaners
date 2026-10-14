import Link from "next/link";
import { minutesToTimeInput } from "@/domain/appointment-panel";
import { formatDayLabel, formatRange } from "@/domain/calendar-view";
import { STAGE_KEYS, STAGE_LABELS, hasDelivery } from "@/domain/delivery";
import { calendarHref } from "@/lib/calendar-links";
import { clearDeliveryAction, deliveryAction, readyDateAction, stageAction } from "@/app/calendar/actions";
import { ActionForm } from "@/components/action-form";
import type { CalendarNav, CalendarTechnician } from "@/components/calendar-types";
import { Icon } from "@/components/icons";
import { Expandable, FIELD, Section } from "@/components/panel-kit";
import type { getAppointment } from "@/server/appointments";

type Detail = Awaited<ReturnType<typeof getAppointment>>;

const STAGE_TIME = new Intl.DateTimeFormat("es-US", {
  timeZone: "America/New_York",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function nextDay(date: string): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function DeliveryFields({ appointment, technicians }: { appointment: Detail; technicians: CalendarTechnician[] }) {
  const scheduled = hasDelivery(appointment);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-soft">
          Fecha
          <input
            type="date"
            name="deliveryDate"
            required
            min={appointment.date}
            defaultValue={scheduled ? appointment.deliveryDate : (appointment.readyDate ?? nextDay(appointment.date))}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-soft">
          Hora
          <input
            type="time"
            name="deliveryTime"
            required
            defaultValue={minutesToTimeInput(scheduled ? appointment.deliveryStartMin : appointment.startMin)}
            className={FIELD}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-soft">
          Duración (min)
          <input
            type="number"
            name="deliveryDuration"
            min={15}
            max={720}
            step={15}
            required
            defaultValue={scheduled ? appointment.deliveryDurationMin : 60}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-soft">
          Técnico
          <select
            name="deliveryTechnicianId"
            defaultValue={scheduled ? appointment.deliveryTechnicianId : appointment.technicianId}
            className={FIELD}
          >
            {technicians.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}

export function AppointmentDeliverySection({
  appointment,
  technicians,
  nav,
}: {
  appointment: Detail;
  technicians: CalendarTechnician[];
  nav: CalendarNav;
}) {
  const id = appointment.id;
  const editable = appointment.status !== "cancelled";
  const deliveryTech = appointment.deliveryTechnician;

  return (
    <Section title="Etapas y entrega">
      <ul className="flex flex-col gap-2">
        {STAGE_KEYS.map((stage) => {
          const mark = appointment.stages[stage];
          return (
            <li
              key={stage}
              className={`flex items-center justify-between gap-3 rounded-md border px-3.5 py-2 text-sm ${
                mark ? "border-success/40 bg-success-soft/50" : "border-hair"
              }`}
            >
              <span className="min-w-0 leading-tight">
                <span className="flex items-center gap-1.5 font-medium">
                  {mark && <span className="text-success">✓</span>}
                  {STAGE_LABELS[stage]}
                </span>
                {mark && (
                  <span className="block text-xs text-soft">
                    {STAGE_TIME.format(new Date(mark.at))} · {mark.by}
                  </span>
                )}
              </span>
              {editable && (
                <ActionForm
                  action={stageAction.bind(null, id)}
                  submit={mark ? "Desmarcar" : "Marcar"}
                  pendingText="…"
                  tone={mark ? "secondary" : "primary"}
                  className="shrink-0"
                >
                  <input type="hidden" name="stage" value={stage} />
                  <input type="hidden" name="done" value={mark ? "0" : "1"} />
                </ActionForm>
              )}
            </li>
          );
        })}
      </ul>

      {editable ? (
        <ActionForm action={readyDateAction.bind(null, id)} submit="Guardar fecha" pendingText="Guardando…">
          <label className="flex flex-col gap-1 text-xs font-medium text-soft">
            Listo en (fecha estimada)
            <input type="date" name="readyDate" defaultValue={appointment.readyDate ?? ""} className={FIELD} />
          </label>
        </ActionForm>
      ) : (
        appointment.readyDate && <p className="text-sm text-soft">Listo en: {formatDayLabel(appointment.readyDate)}</p>
      )}

      {hasDelivery(appointment) && deliveryTech ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-brand/50 bg-brand-soft/30 px-3.5 py-3 text-sm">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-ink">
            <Icon name="calendar" size={13} /> Entrega programada
          </span>
          <span className="font-medium">
            {formatDayLabel(appointment.deliveryDate)} ·{" "}
            {formatRange(appointment.deliveryStartMin, appointment.deliveryDurationMin)}
          </span>
          <span className="flex items-center gap-2 text-soft">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: deliveryTech.color }} />
            {deliveryTech.name}
          </span>
          <Link
            href={calendarHref({
              view: "day",
              date: appointment.deliveryDate,
              tech: nav.tech,
              entregas: true,
              appt: id,
            })}
            scroll={false}
            className="w-fit text-xs font-semibold text-brand-ink underline underline-offset-2"
          >
            Ver ese día con las entregas
          </Link>
          {editable && (
            <div className="flex flex-col gap-2">
              <Expandable title="Cambiar entrega">
                <ActionForm action={deliveryAction.bind(null, id)} submit="Guardar entrega" pendingText="Guardando…">
                  <DeliveryFields appointment={appointment} technicians={technicians} />
                </ActionForm>
              </Expandable>
              <ActionForm
                action={clearDeliveryAction.bind(null, id)}
                submit="Quitar entrega"
                pendingText="Quitando…"
                tone="danger"
              />
            </div>
          )}
        </div>
      ) : (
        editable && (
          <Expandable title="Programar entrega">
            <ActionForm
              action={deliveryAction.bind(null, id)}
              submit="Programar entrega"
              pendingText="Guardando…"
              tone="primary"
            >
              <DeliveryFields appointment={appointment} technicians={technicians} />
            </ActionForm>
          </Expandable>
        )
      )}
    </Section>
  );
}
