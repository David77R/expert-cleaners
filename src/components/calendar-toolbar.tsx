import Link from "next/link";
import {
  CALENDAR_VIEWS,
  initialsOf,
  readableOn,
  shiftAnchor,
  viewHeading,
  type CalendarView,
} from "@/domain/calendar-view";
import { calendarHref } from "@/lib/calendar-links";
import { DateJump } from "@/components/date-jump";
import { Icon } from "@/components/icons";
import type { CalendarTechnician } from "@/components/calendar-types";

const VIEW_LABEL: Record<CalendarView, string> = { day: "Día", week: "Semana", month: "Mes" };
const STEP_LABEL: Record<CalendarView, string> = { day: "día", week: "semana", month: "mes" };

export function CalendarToolbar({
  view,
  date,
  today,
  tech,
  technicians,
  mapa,
  entregas,
  deliveryCount,
}: {
  view: CalendarView;
  date: string;
  today: string;
  tech: string | null;
  technicians: CalendarTechnician[];
  mapa: boolean;
  entregas: boolean;
  deliveryCount: number;
}) {
  const heading = viewHeading(view, date);
  const previous = calendarHref({ view, date: shiftAnchor(view, date, -1), tech, mapa, entregas });
  const next = calendarHref({ view, date: shiftAnchor(view, date, 1), tech, mapa, entregas });
  const toggleHref = calendarHref({ view, date, tech, mapa, entregas: !entregas });
  const atToday = view === "day" ? date === today : false;
  const newAppointmentParams = new URLSearchParams({ date });
  if (tech) newAppointmentParams.set("tech", tech);
  const newAppointmentHref = `/appointments/new?${newAppointmentParams.toString()}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center overflow-hidden rounded-md border border-hair bg-paper">
            <Link
              href={previous}
              aria-label={`Ir a ${STEP_LABEL[view]} anterior`}
              className="flex h-10 w-10 items-center justify-center text-soft transition-colors hover:bg-canvas"
            >
              <Icon name="left" />
            </Link>
            <Link
              href={calendarHref({ view, date: today, tech, mapa, entregas })}
              aria-current={atToday ? "date" : undefined}
              className={`flex h-10 items-center border-x border-hair px-4 text-sm font-semibold transition-colors ${
                atToday ? "bg-brand-soft text-brand-ink" : "text-ink hover:bg-canvas"
              }`}
            >
              Hoy
            </Link>
            <Link
              href={next}
              aria-label={`Ir a ${STEP_LABEL[view]} siguiente`}
              className="flex h-10 w-10 items-center justify-center text-soft transition-colors hover:bg-canvas"
            >
              <Icon name="right" />
            </Link>
            <span className="border-l border-hair">
              <DateJump view={view} date={date} tech={tech} mapa={mapa} entregas={entregas} />
            </span>
          </div>

          <h1 className="flex flex-col leading-none">
            <span className="font-display text-xl font-semibold tracking-tight">{heading.primary}</span>
            <span className="mt-1.5 text-sm text-soft">{heading.secondary}</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href={toggleHref}
            scroll={false}
            aria-pressed={entregas}
            className={`flex items-center gap-2 rounded-md border px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              entregas
                ? "border-brand bg-brand-soft text-brand-ink"
                : "border-dashed border-hair bg-paper text-soft hover:text-ink"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-4 w-4 items-center justify-center rounded-[3px] border text-[10px] ${
                entregas ? "border-brand bg-brand text-white" : "border-hair"
              }`}
            >
              {entregas ? "✓" : ""}
            </span>
            Entregas
            <span className="font-display tabular-nums text-muted">{deliveryCount}</span>
          </Link>
          <Link
            href={newAppointmentHref}
            className="flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Icon name="plus" />
            Nueva cita
          </Link>
          <div role="group" aria-label="Vista" className="flex gap-1 border-b border-hair">
            {CALENDAR_VIEWS.map((option) => {
              const current = !mapa && option === view;
              return (
                <Link
                  key={option}
                  href={calendarHref({ view: option, date, tech, entregas })}
                  aria-current={current ? "true" : undefined}
                  className={`-mb-px border-b-[3px] px-4 py-2.5 text-sm font-semibold transition-colors ${
                    current ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {VIEW_LABEL[option]}
                </Link>
              );
            })}
            <Link
              href={calendarHref({ view: "day", date, tech, mapa: true, entregas })}
              aria-current={mapa ? "true" : undefined}
              className={`-mb-px flex items-center gap-1.5 border-b-[3px] px-4 py-2.5 text-sm font-semibold transition-colors ${
                mapa ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <Icon name="pin" size={14} />
              Mapa
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-1 gap-y-2" role="group" aria-label="Filtrar por técnico">
        <Link
          href={calendarHref({ view, date, entregas })}
          aria-current={tech === null ? "true" : undefined}
          className={`border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${
            tech === null ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Todos los técnicos
        </Link>
        {technicians.map((technician) => {
          const current = technician.id === tech;
          return (
            <Link
              key={technician.id}
              href={calendarHref({ view, date, tech: technician.id, entregas })}
              aria-current={current ? "true" : undefined}
              className={`flex items-center gap-2 border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                current ? "text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
              style={current ? { borderBottomColor: technician.color } : undefined}
            >
              <span
                className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] text-[10px] font-bold"
                style={{ backgroundColor: technician.color, color: readableOn(technician.color) }}
              >
                {initialsOf(technician.name)}
              </span>
              {technician.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
