"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { MouseEvent } from "react";
import { Icon } from "@/components/icons";
import { NavProgressBar, useNavProgress } from "@/components/nav-progress";
import { PreviewLink } from "@/components/preview-link";

const MAP_HREF = "/calendar?mapa=1";

function useCalendarPlace() {
  const pathname = usePathname();
  const params = useSearchParams();
  const onCalendar = pathname === "/calendar";
  const onMap = onCalendar && params.get("mapa") === "1";
  return { onCalendar: onCalendar && !onMap, onMap };
}

export function MapLink({ tone }: { tone: "light" | "dark" }) {
  const { onMap } = useCalendarPlace();
  const { navigating, start } = useNavProgress();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (plain && !onMap) start();
  }

  if (tone === "dark") {
    return (
      <>
        <NavProgressBar show={navigating} />
        <Link
          href={MAP_HREF}
          onClick={onClick}
          aria-label="Mapa y rutas de hoy"
          aria-current={onMap ? "page" : undefined}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
            onMap ? "bg-brand text-white" : "text-rail-text hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          <Icon name="map" size={20} />
        </Link>
      </>
    );
  }

  return (
    <>
      <NavProgressBar show={navigating} />
      <Link
        href={MAP_HREF}
        onClick={onClick}
        aria-label="Mapa y rutas de hoy"
        aria-current={onMap ? "page" : undefined}
        className={`group relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-4 text-sm font-semibold transition-all ${
          onMap
            ? "bg-brand-soft text-brand-ink ring-2 ring-brand"
            : "border border-brand/35 bg-paper text-brand-ink shadow-sm hover:-translate-y-px hover:border-brand hover:shadow-md"
        }`}
      >
        <span
          className={`relative flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
            onMap ? "bg-brand text-white" : "bg-brand-soft text-brand group-hover:bg-brand group-hover:text-white"
          }`}
        >
          <Icon name="map" size={16} />
          {!onMap && (
            <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-paper" />
            </span>
          )}
        </span>
        Mapa
      </Link>
    </>
  );
}

export function CalendarTodayLink() {
  const { onCalendar } = useCalendarPlace();
  return (
    <PreviewLink
      section="today"
      href="/calendar"
      aria-label="Calendario de hoy"
      title="Calendario de hoy"
      aria-current={onCalendar ? "page" : undefined}
      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
        onCalendar ? "bg-indigo text-white shadow-sm" : "bg-indigo-soft/70 text-indigo hover:bg-indigo-soft"
      }`}
    >
      <Icon name="calendar" size={19} />
    </PreviewLink>
  );
}

export function MapLinkFallback() {
  return (
    <span className="flex shrink-0 items-center gap-2 rounded-full border border-brand/35 bg-paper py-1.5 pl-1.5 pr-4 text-sm font-semibold text-brand-ink">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon name="map" size={16} />
      </span>
      Mapa
    </span>
  );
}
