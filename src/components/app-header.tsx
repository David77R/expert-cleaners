import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import type { Actor } from "@/db/schema";
import { WEEKDAY_LONG, initialsOf, viewHeading, weekdayIndex } from "@/domain/calendar-view";
import { todayIn } from "@/domain/date-rules";
import { logout } from "@/app/login/actions";
import { AlertsBell, BellLink } from "@/components/alerts-bell";
import { Icon, type IconName } from "@/components/icons";

type Section =
  "home" | "orders" | "calendar" | "customers" | "services" | "agents" | "technicians" | "reports" | "alerts";

const LINKS: { key: Section; href: string; label: string; icon: IconName; adminOnly?: boolean }[] = [
  { key: "home", href: "/inicio", label: "Inicio", icon: "home" },
  { key: "orders", href: "/orders/new", label: "Nuevo pedido", icon: "plus" },
  { key: "customers", href: "/customers", label: "Clientes", icon: "users" },
  { key: "services", href: "/services", label: "Servicios", icon: "tag", adminOnly: true },
  { key: "calendar", href: "/calendar", label: "Calendario", icon: "calendar" },
  { key: "agents", href: "/agents", label: "Agentes", icon: "agent", adminOnly: true },
  { key: "technicians", href: "/technicians", label: "Técnicos", icon: "wrench", adminOnly: true },
  { key: "reports", href: "/reports", label: "Reportes", icon: "report" },
];

function Brand() {
  return (
    <Link href="/inicio" aria-label="Expert Cleaners: inicio" className="flex shrink-0 items-center gap-3">
      <span className="font-display flex h-9 w-9 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">
        EC
      </span>
      <span className="font-display text-[17px] font-semibold leading-none text-white">
        Expert Cleaners
        <span className="mt-1 block text-[11px] font-normal text-rail-text">Centro de operaciones</span>
      </span>
    </Link>
  );
}

function RoleLabel({ role }: { role: Actor["role"] }) {
  return role === "admin" ? "Administrador" : "Agente";
}

export function AppShell({ active, actor, children }: { active: Section; actor: Actor; children: ReactNode }) {
  const today = todayIn();
  const month = viewHeading("month", today);
  const links = LINKS.filter((link) => !link.adminOnly || actor.role === "admin");

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col bg-rail lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="px-5 pb-4 pt-6">
          <Brand />
        </div>

        <Link
          href="/calendar"
          aria-label={`Ir a hoy: ${WEEKDAY_LONG[weekdayIndex(today)]} ${Number(today.slice(8, 10))} de ${month.primary.toLowerCase()} de ${month.secondary}`}
          className="mx-3 flex items-center gap-3 rounded-xl border border-rail-line bg-rail-raised px-3 py-2.5 transition-colors hover:bg-rail-line"
        >
          <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-base font-semibold leading-none tabular-nums text-white">
            {Number(today.slice(8, 10))}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-medium text-white">
              Hoy, {WEEKDAY_LONG[weekdayIndex(today)].toLowerCase()}
            </span>
            <span className="block truncate text-xs capitalize text-rail-text">
              {month.primary} {month.secondary}
            </span>
          </span>
        </Link>

        <nav aria-label="Principal" className="mt-5 flex flex-col gap-1 px-3">
          {links.map((link) => {
            const current = link.key === active;
            return (
              <Link
                key={link.key}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  current
                    ? "bg-brand/20 text-white ring-1 ring-inset ring-brand/40"
                    : "text-rail-text hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <Icon name={link.icon} size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-rail-line px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-rail-line text-xs font-semibold text-white">
              {initialsOf(actor.name)}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-medium text-white">{actor.name}</span>
              <span className="block text-xs text-rail-text">
                <RoleLabel role={actor.role} />
              </span>
            </span>
          </div>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rail-text transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Icon name="logout" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-3 bg-rail px-4 py-2.5 lg:hidden">
        <Link
          href="/inicio"
          aria-label="Expert Cleaners: inicio"
          className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand text-sm font-bold text-white"
        >
          EC
        </Link>
        <nav aria-label="Principal" className="flex min-w-0 flex-1 items-center gap-1">
          {links.map((link) => {
            const current = link.key === active;
            return (
              <Link
                key={link.key}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  current ? "bg-brand/20 text-white" : "text-rail-text hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <Icon name={link.icon} />
                <span className={current ? undefined : "sr-only min-[420px]:not-sr-only"}>{link.label}</span>
              </Link>
            );
          })}
        </nav>
        <Suspense fallback={<BellLink count={null} active={active === "alerts"} tone="dark" />}>
          <AlertsBell active={active === "alerts"} tone="dark" />
        </Suspense>
        <form action={logout}>
          <button type="submit" aria-label="Cerrar sesión" className="rounded-md p-2 text-rail-text hover:text-white">
            <Icon name="logout" />
          </button>
        </form>
      </header>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 hidden items-center justify-end gap-3 border-b border-hair bg-paper/85 px-8 py-2 backdrop-blur lg:flex">
          <Suspense fallback={<BellLink count={null} active={active === "alerts"} tone="light" />}>
            <AlertsBell active={active === "alerts"} tone="light" />
          </Suspense>
        </div>
        {children}
      </div>
    </div>
  );
}
