"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Icon } from "@/components/icons";
import type { CalendarView } from "@/domain/calendar-view";
import { calendarHref } from "@/lib/calendar-links";

export function DateJump({
  view,
  date,
  tech,
  mapa,
  entregas,
}: {
  view: CalendarView;
  date: string;
  tech: string | null;
  mapa: boolean;
  entregas: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  function open() {
    const field = input.current;
    if (!field) return;
    try {
      field.showPicker();
    } catch {
      field.focus();
      field.click();
    }
  }

  return (
    <span className="relative flex">
      <button
        type="button"
        onClick={open}
        aria-label="Elegir un día en el calendario"
        title="Elegir un día"
        className="flex h-10 w-10 items-center justify-center text-soft transition-colors hover:bg-canvas hover:text-ink"
      >
        <Icon name="calendar" />
      </button>
      <input
        ref={input}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={date}
        onChange={(event) => {
          const value = event.target.value;
          if (/^\d{4}-\d{2}-\d{2}$/.test(value)) router.push(calendarHref({ view, date: value, tech, mapa, entregas }));
        }}
        className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
      />
    </span>
  );
}
