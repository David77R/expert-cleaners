"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { loadNavPreview, type NavPreviewResult } from "@/app/nav-preview/actions";
import { Icon, type IconName } from "@/components/icons";
import { NavProgressBar, useNavProgress } from "@/components/nav-progress";
import type { AlertLevel, AlertType } from "@/domain/alert-rules";
import { formatTime, initialsOf } from "@/domain/calendar-view";
import { splitActive, type NavPreview, type NavPreviewSection, type PreviewAppointment } from "@/domain/nav-preview";

const SECTION_COPY: Record<NavPreviewSection, { title: string; subtitle: string; go: string; icon: IconName }> = {
  today: { title: "Calendario de hoy", subtitle: "Todas las citas del día", go: "Ir al calendario", icon: "calendar" },
  active: {
    title: "Servicios activos hoy",
    subtitle: "Lo que está en curso y lo que sigue",
    go: "Ver en el calendario",
    icon: "car",
  },
  alerts: { title: "Alertas", subtitle: "Lo que necesita atención", go: "Ir a alertas", icon: "bell" },
};

const STATUS_NAMES: Record<PreviewAppointment["status"], string> = {
  not_confirmed: "Sin confirmar",
  confirmed: "Confirmada",
  rescheduled: "Reprogramada",
  cancelled: "Cancelada",
  completed: "Completada",
};

const STATUS_TONE: Record<PreviewAppointment["status"], string> = {
  not_confirmed: "bg-warning-soft text-warning",
  confirmed: "bg-brand-soft text-brand-ink",
  rescheduled: "bg-info-soft text-info",
  cancelled: "bg-canvas text-muted",
  completed: "bg-success-soft text-success",
};

const ALERT_NAMES: Record<AlertType, string> = {
  not_confirmed: "Citas sin confirmar",
  overlap: "Choques de horario",
  completed_unpaid: "Completadas sin cobrar",
  rescheduled: "Reprogramadas",
};

const ALERT_TONE: Record<AlertLevel, { box: string; text: string; icon: IconName }> = {
  attention: { box: "bg-attention-soft", text: "text-attention", icon: "alert" },
  warning: { box: "bg-warning-soft", text: "text-warning", icon: "clock" },
  info: { box: "bg-info-soft", text: "text-info", icon: "note" },
};

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "brand" | "warning";
}) {
  const box =
    tone === "brand"
      ? "border-brand/30 bg-brand-soft"
      : tone === "warning"
        ? "border-warning/30 bg-warning-soft"
        : "border-hair bg-canvas/60";
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${box}`}>
      <span className="block text-xs font-medium text-soft">{label}</span>
      <span className="font-display mt-0.5 block text-2xl font-semibold tabular-nums leading-tight">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-1.5 mt-5 text-xs font-semibold uppercase tracking-wide text-muted first:mt-0">{children}</h3>
  );
}

function Empty({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-hair px-6 py-8 text-center">
      <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-success-soft text-success">
        <Icon name={icon} size={20} />
      </span>
      <p className="font-display font-semibold">{title}</p>
      <p className="max-w-xs text-sm text-soft">{text}</p>
    </div>
  );
}

function AppointmentRow({
  appointment,
  date,
  onGo,
  highlight = false,
}: {
  appointment: PreviewAppointment;
  date: string;
  onGo: () => void;
  highlight?: boolean;
}) {
  const cancelled = appointment.status === "cancelled";
  return (
    <li>
      <Link
        href={`/calendar?date=${date}&appt=${appointment.id}`}
        onClick={onGo}
        className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-canvas ${
          highlight ? "bg-brand-soft/60" : ""
        }`}
      >
        <span className="w-[4.25rem] shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
          {formatTime(appointment.startMin)}
        </span>
        <span
          aria-hidden="true"
          className="h-9 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: appointment.technicianColor }}
        />
        <span className={`min-w-0 flex-1 ${cancelled ? "opacity-55" : ""}`}>
          <span className={`block truncate text-sm font-medium ${cancelled ? "line-through" : ""}`}>
            {appointment.customerName}
          </span>
          <span className="block truncate text-xs text-soft">
            {appointment.serviceName} · {appointment.city} · {appointment.technicianName}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[appointment.status]}`}
        >
          {STATUS_NAMES[appointment.status]}
        </span>
      </Link>
    </li>
  );
}

function AppointmentList({
  items,
  date,
  onGo,
  highlight = false,
}: {
  items: PreviewAppointment[];
  date: string;
  onGo: () => void;
  highlight?: boolean;
}) {
  return (
    <ul className="-mx-2.5 flex flex-col">
      {items.map((appointment) => (
        <AppointmentRow key={appointment.id} appointment={appointment} date={date} onGo={onGo} highlight={highlight} />
      ))}
    </ul>
  );
}

function Skeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="h-[70px] rounded-xl bg-canvas" />
        <div className="h-[70px] rounded-xl bg-canvas" />
        <div className="h-[70px] rounded-xl bg-canvas" />
      </div>
      <div className="mt-2 h-3 w-28 rounded bg-canvas" />
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex items-center gap-3 px-2.5 py-1.5">
          <div className="h-3 w-14 rounded bg-canvas" />
          <div className="h-9 w-1 rounded-full bg-canvas" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3 w-2/5 rounded bg-canvas" />
            <div className="h-2.5 w-3/5 rounded bg-canvas" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PreviewBody({ preview, onGo }: { preview: NavPreview; onGo: () => void }) {
  if (preview.section === "today") {
    const live = preview.appointments.filter((appointment) => appointment.status !== "cancelled");
    return (
      <>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Citas" value={live.length} />
          <Stat
            label="Sin confirmar"
            value={live.filter((appointment) => appointment.status === "not_confirmed").length}
            tone="warning"
          />
          <Stat
            label="Completadas"
            value={live.filter((appointment) => appointment.status === "completed").length}
            tone="brand"
          />
        </div>
        <SectionTitle>Agenda</SectionTitle>
        {preview.appointments.length === 0 ? (
          <Empty icon="calendar" title="Día libre" text="Todavía no hay citas para hoy." />
        ) : (
          <AppointmentList items={preview.appointments} date={preview.date} onGo={onGo} />
        )}
      </>
    );
  }

  if (preview.section === "active") {
    const { now, next, late } = splitActive(preview.appointments, preview.nowMin);
    return (
      <>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="En curso" value={now.length} tone="brand" />
          <Stat label="Por empezar" value={next.length} />
          <Stat label="Sin cerrar" value={late.length} tone={late.length > 0 ? "warning" : "default"} />
        </div>
        {preview.appointments.length === 0 ? (
          <div className="mt-4">
            <Empty icon="check" title="Todo al día" text="No quedan servicios pendientes por hoy." />
          </div>
        ) : (
          <>
            {now.length > 0 && (
              <>
                <SectionTitle>En curso ahora</SectionTitle>
                <AppointmentList items={now} date={preview.date} onGo={onGo} highlight />
              </>
            )}
            {next.length > 0 && (
              <>
                <SectionTitle>Lo que sigue</SectionTitle>
                <AppointmentList items={next} date={preview.date} onGo={onGo} />
              </>
            )}
            {late.length > 0 && (
              <>
                <SectionTitle>Ya pasó la hora y siguen abiertas</SectionTitle>
                <AppointmentList items={late} date={preview.date} onGo={onGo} />
              </>
            )}
          </>
        )}
      </>
    );
  }

  if (preview.groups.length === 0) {
    return (
      <Empty
        icon="check"
        title="Sin alertas pendientes"
        text="No hay citas sin confirmar, choques, cobros pendientes ni reprogramaciones."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {preview.groups.map((group) => {
        const tone = ALERT_TONE[group.level];
        const rest = group.count - group.appointments.length;
        return (
          <section key={group.type} className="overflow-hidden rounded-xl border border-hair">
            <div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${tone.box}`}>
              <span className={`flex items-center gap-2 text-sm font-semibold ${tone.text}`}>
                <Icon name={tone.icon} size={15} />
                {ALERT_NAMES[group.type]}
              </span>
              <span className={`font-display text-sm font-bold tabular-nums ${tone.text}`}>{group.count}</span>
            </div>
            <ul className="divide-y divide-hair">
              {group.appointments.map((appointment) => (
                <li key={appointment.id}>
                  <Link
                    href={`/calendar?date=${appointment.date}&appt=${appointment.id}`}
                    onClick={onGo}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-canvas"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-[11px] font-bold text-soft">
                      {initialsOf(appointment.customerName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{appointment.customerName}</span>
                      <span className="block text-xs text-soft">
                        {appointment.code}
                        {appointment.date !== preview.date ? ` · ${appointment.date}` : ""} ·{" "}
                        {formatTime(appointment.startMin)}
                      </span>
                    </span>
                    <Icon name="right" size={16} className="shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
            {rest > 0 && <p className="border-t border-hair px-4 py-2 text-xs text-soft">y {rest} más en Alertas</p>}
          </section>
        );
      })}
    </div>
  );
}

function PreviewModal({
  section,
  href,
  result,
  onClose,
  onGo,
}: {
  section: NavPreviewSection;
  href: string;
  result: NavPreviewResult | undefined;
  onClose: () => void;
  onGo: () => void;
}) {
  const primary = useRef<HTMLAnchorElement>(null);
  const closeRef = useRef(onClose);
  const copy = SECTION_COPY[section];
  const titleId = `preview-${section}`;

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 backdrop-blur-[2px] sm:items-center sm:p-6">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="fixed inset-0 cursor-default" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="nav-preview-in relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-hair bg-paper text-ink shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center gap-3 border-b border-hair px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <Icon name={copy.icon} size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-lg font-semibold leading-tight">
              {copy.title}
            </h2>
            <span className="block text-sm text-soft">{copy.subtitle}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-soft hover:bg-canvas"
          >
            <Icon name="close" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" aria-busy={!result}>
          {!result ? (
            <Skeleton />
          ) : result.ok ? (
            <PreviewBody preview={result.preview} onGo={onGo} />
          ) : (
            <p role="alert" className="rounded-xl bg-attention-soft px-4 py-3 text-sm text-attention">
              {result.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hair bg-canvas/40 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-soft hover:bg-canvas"
          >
            Cerrar
          </button>
          <Link
            ref={primary}
            href={href}
            onClick={onGo}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {copy.go}
            <Icon name="right" size={16} />
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function PreviewLink({
  section,
  href,
  direct = false,
  className,
  children,
  ...rest
}: {
  section: NavPreviewSection;
  href: string;
  direct?: boolean;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  "aria-current"?: "page";
  title?: string;
}) {
  const router = useRouter();
  const { navigating, start } = useNavProgress();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<NavPreviewResult | undefined>(undefined);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (!plain) return;
    if (direct) {
      start();
      return;
    }
    event.preventDefault();
    setOpen(true);
    router.prefetch(href);
    void loadNavPreview(section).then(setResult);
  }

  return (
    <>
      <NavProgressBar show={navigating} />
      <Link
        href={href}
        prefetch={false}
        onClick={onClick}
        aria-haspopup={direct ? undefined : "dialog"}
        className={className}
        {...rest}
      >
        {children}
      </Link>
      {open && (
        <PreviewModal
          section={section}
          href={href}
          result={result}
          onClose={() => setOpen(false)}
          onGo={() => {
            setOpen(false);
            start();
          }}
        />
      )}
    </>
  );
}
