import Link from "next/link";
import type { ReactNode } from "react";
import type { Actor } from "@/db/schema";
import { WEEKDAY_LONG, initialsOf, viewHeading, weekdayIndex } from "@/domain/calendar-view";
import { todayIn } from "@/domain/date-rules";
import { logout } from "@/app/login/actions";
import { Icon, type IconName } from "@/components/icons";

type Section = "calendar" | "customers" | "services";

const LINKS: { key: Section; href: string; label: string; icon: IconName; adminOnly?: boolean }[] = [
  { key: "calendar", href: "/calendar", label: "Calendario", icon: "calendar" },
  { key: "customers", href: "/customers", label: "Clientes", icon: "users" },
  { key: "services", href: "/services", label: "Servicios", icon: "tag", adminOnly: true },
];

function Brand() {
  return (
    <Link href="/calendar" aria-label="Expert Cleaners" className="flex shrink-0 items-center gap-3">
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
          className="mx-5 flex items-center gap-3 rounded-md border border-rail-line bg-rail-raised px-3 py-2.5 transition-colors hover:bg-rail-line"
        >
          <span className="font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand text-[22px] font-semibold leading-none tabular-nums text-white">
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

        <nav aria-label="Principal" className="mt-5 flex flex-col">
          {links.map((link) => {
            const current = link.key === active;
            return (
              <Link
                key={link.key}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`flex items-center gap-3 border-l-[3px] px-5 py-3 text-sm font-medium transition-colors ${
                  current
                    ? "border-brand bg-rail-raised text-white"
                    : "border-transparent text-rail-text hover:bg-rail-raised hover:text-white"
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
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-rail-text transition-colors hover:bg-rail-raised hover:text-white"
            >
              <Icon name="logout" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-3 bg-rail px-4 py-2.5 lg:hidden">
        <Link
          href="/calendar"
          aria-label="Expert Cleaners"
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
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                  current ? "bg-rail-raised text-white" : "text-rail-text"
                }`}
              >
                <Icon name={link.icon} />
                <span className={current ? undefined : "sr-only min-[420px]:not-sr-only"}>{link.label}</span>
              </Link>
            );
          })}
        </nav>
        <form action={logout}>
          <button type="submit" aria-label="Cerrar sesión" className="rounded-md p-2 text-rail-text hover:text-white">
            <Icon name="logout" />
          </button>
        </form>
      </header>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
