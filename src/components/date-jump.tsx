"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { MONTHS, WEEKDAY_NARROW, formatDayLabel, weekdayIndex, type CalendarView } from "@/domain/calendar-view";
import { addDays, todayIn } from "@/domain/date-rules";
import { calendarHref } from "@/lib/calendar-links";

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function shiftMonth(start: string, delta: number): string {
  const year = Number(start.slice(0, 4));
  const month = Number(start.slice(5, 7)) - 1 + delta;
  const shifted = new Date(Date.UTC(year, month, 1));
  return shifted.toISOString().slice(0, 10);
}

export function monthGrid(start: string): string[] {
  const first = addDays(start, -weekdayIndex(start));
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

function usePopover() {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { box, open, setOpen };
}

function MiniCalendar({
  selected,
  today,
  min,
  onPick,
  footer,
}: {
  selected: string;
  today: string;
  min?: string;
  onPick: (date: string) => void;
  footer?: ReactNode;
}) {
  const [shown, setShown] = useState(monthStart(selected || today));
  const days = monthGrid(shown);
  const month = Number(shown.slice(5, 7));
  const year = shown.slice(0, 4);

  return (
    <>
      <div className="flex items-center justify-between bg-brand px-3 py-2.5 text-white">
        <button
          type="button"
          onClick={() => setShown(shiftMonth(shown, -1))}
          aria-label="Mes anterior"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15"
        >
          <Icon name="left" size={16} />
        </button>
        <span className="font-display text-base font-semibold capitalize">
          {MONTHS[month - 1]} {year}
        </span>
        <button
          type="button"
          onClick={() => setShown(shiftMonth(shown, 1))}
          aria-label="Mes siguiente"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15"
        >
          <Icon name="right" size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 px-3 pb-1 pt-3 text-center">
        {WEEKDAY_NARROW.map((label, index) => (
          <span key={index} className="text-[11px] font-semibold uppercase text-muted">
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 px-3 pb-3">
        {days.map((day) => {
          const inMonth = Number(day.slice(5, 7)) === month;
          const isSelected = day === selected;
          const isToday = day === today;
          const disabled = Boolean(min && day < min);
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => onPick(day)}
              aria-label={day}
              aria-current={isSelected ? "date" : undefined}
              className={`relative flex h-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                isSelected
                  ? "bg-brand font-semibold text-white"
                  : isToday
                    ? "font-semibold text-brand-ink ring-1 ring-inset ring-brand hover:bg-brand-soft"
                    : inMonth
                      ? "text-ink hover:bg-brand-soft"
                      : "text-muted/60 hover:bg-canvas"
              }`}
            >
              {Number(day.slice(8, 10))}
            </button>
          );
        })}
      </div>
      {footer && (
        <div className="flex items-center justify-between border-t border-hair bg-canvas/60 px-3 py-2">{footer}</div>
      )}
    </>
  );
}

const QUICK = "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors";

export function DatePicker({
  date,
  today,
  hrefFor,
  align = "left",
}: {
  date: string;
  today: string;
  hrefFor: (date: string) => string;
  align?: "left" | "right";
}) {
  const router = useRouter();
  const { box, open, setOpen } = usePopover();

  function pick(value: string) {
    setOpen(false);
    router.push(hrefFor(value));
  }

  return (
    <div ref={box} className="relative flex">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Elegir un día en el calendario"
        aria-expanded={open}
        title="Elegir un día"
        className={`flex h-10 w-10 items-center justify-center rounded-md border transition-colors ${
          open
            ? "border-brand bg-brand text-white"
            : "border-hair bg-paper text-soft hover:border-brand/50 hover:bg-brand-soft hover:text-brand-ink"
        }`}
      >
        <Icon name="calendar" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Elegir día"
          className={`absolute top-12 z-40 w-[18.5rem] ${align === "right" ? "right-0" : "left-0"} overflow-hidden rounded-xl border border-hair bg-paper shadow-xl`}
        >
          <MiniCalendar
            selected={date}
            today={today}
            onPick={pick}
            footer={
              <>
                <button
                  type="button"
                  onClick={() => pick(today)}
                  className={`${QUICK} bg-brand-soft text-brand-ink hover:bg-brand hover:text-white`}
                >
                  Ir a hoy
                </button>
                <button
                  type="button"
                  onClick={() => pick(addDays(today, 1))}
                  className={`${QUICK} text-soft hover:bg-paper hover:text-ink`}
                >
                  Mañana
                </button>
              </>
            }
          />
        </div>
      )}
    </div>
  );
}

export function DateJump({
  view,
  date,
  today,
  tech,
  mapa,
  entregas,
  estado = null,
}: {
  view: CalendarView;
  date: string;
  today: string;
  tech: string | null;
  mapa: boolean;
  entregas: boolean;
  estado?: string | null;
}) {
  return (
    <DatePicker
      date={date}
      today={today}
      hrefFor={(value) => calendarHref({ view, date: value, tech, mapa, entregas, estado })}
    />
  );
}

export function AlertsDatePicker({ date, today }: { date: string; today: string }) {
  return <DatePicker date={date} today={today} align="right" hrefFor={(value) => `/alerts?date=${value}`} />;
}

export function DateInput({
  name,
  value,
  defaultValue = "",
  onChange,
  min,
  required,
  clearable = false,
  placeholder = "Elige una fecha",
  className = "",
  id,
  align = "left",
  ...aria
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  required?: boolean;
  clearable?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  align?: "left" | "right";
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
}) {
  const { box, open, setOpen } = usePopover();
  const [own, setOwn] = useState(defaultValue);
  const current = value ?? own;
  const today = todayIn();

  function pick(next: string) {
    if (value === undefined) setOwn(next);
    onChange?.(next);
    setOpen(false);
  }

  return (
    <div ref={box} className="relative">
      {name && <input type="hidden" name={name} value={current} />}
      <button
        id={id}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-describedby={aria["aria-describedby"]}
        aria-label={aria["aria-label"]}
        className={`${className} flex w-full items-center justify-between gap-2 text-left ${
          open ? "border-brand ring-2 ring-brand/20" : ""
        } ${aria["aria-invalid"] ? "!border-attention" : ""}`}
      >
        <span className={current ? "" : "text-muted"}>
          {current ? `${formatDayLabel(current)} ${current.slice(0, 4)}` : `${placeholder}${required ? " *" : ""}`}
        </span>
        <Icon name="calendar" size={16} className={open ? "text-brand-ink" : "text-muted"} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Elegir fecha"
          className={`absolute top-full z-50 mt-1.5 w-[18.5rem] ${align === "right" ? "right-0" : "left-0"} overflow-hidden rounded-xl border border-hair bg-paper shadow-xl`}
        >
          <MiniCalendar
            selected={current}
            today={today}
            min={min}
            onPick={pick}
            footer={
              <>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => pick(today)}
                    disabled={Boolean(min && today < min)}
                    className={`${QUICK} bg-brand-soft text-brand-ink hover:bg-brand hover:text-white disabled:opacity-40`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => pick(addDays(today, 1))}
                    disabled={Boolean(min && addDays(today, 1) < min)}
                    className={`${QUICK} text-soft hover:bg-paper hover:text-ink disabled:opacity-40`}
                  >
                    Mañana
                  </button>
                </span>
                {clearable && current && (
                  <button
                    type="button"
                    onClick={() => pick("")}
                    className={`${QUICK} text-attention hover:bg-attention-soft`}
                  >
                    Borrar
                  </button>
                )}
              </>
            }
          />
        </div>
      )}
    </div>
  );
}
