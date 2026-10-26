import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import type { Actor } from "@/db/schema";
import { WEEKDAY_LONG, initialsOf, viewHeading, weekdayIndex } from "@/domain/calendar-view";
import { todayIn } from "@/domain/date-rules";
import { logout } from "@/app/login/actions";
import { AlertsBell, BellLink } from "@/components/alerts-bell";
import { Icon, type IconName } from "@/components/icons";
import { BrandMark } from "@/components/brand-mark";
import { MobileNav } from "@/components/mobile-nav";
import { client } from "@/config/clients";
import { GlobalSearch, MiamiClock } from "@/components/top-bar-tools";

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

const TITLES: Record<Section, string> = {
  home: "Inicio",
  orders: "Nuevo pedido",
  calendar: "Calendario",
  customers: "Clientes",
  services: "Servicios",
  agents: "Agentes",
  technicians: "Técnicos",
  reports: "Reportes",
  alerts: "Alertas",
};

function Brand() {
  return (
    <Link href="/inicio" aria-label={`${client.name}: inicio`} className="flex shrink-0 items-center gap-3">
      <BrandMark size={client.logo ? "lg" : "md"} />
      <span className="font-display min-w-0 text-[17px] font-semibold leading-none text-white">
        {client.logo ? <span className="sr-only">{client.name}</span> : client.shortName}
        <span className="mt-1 block text-[11px] font-normal text-rail-text">{client.tagline}</span>
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

      <MobileNav
        links={[...links, { key: "alerts", href: "/alerts", label: "Alertas", icon: "bell" }]}
        active={active}
        title={TITLES[active]}
        userName={actor.name}
        userInitials={initialsOf(actor.name)}
        roleLabel={actor.role === "admin" ? "Administrador" : "Agente"}
        logout={logout}
        brand={<BrandMark size="sm" />}
        bell={
          <Suspense fallback={<BellLink count={null} active={active === "alerts"} tone="dark" />}>
            <AlertsBell active={active === "alerts"} tone="dark" />
          </Suspense>
        }
      />

      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <div className="sticky top-0 z-30 hidden items-center gap-4 border-b border-hair bg-paper/90 px-8 py-2.5 backdrop-blur lg:flex">
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-3">
            <MiamiClock />
            <span aria-hidden="true" className="hidden h-8 w-px bg-hair xl:block" />
            <Link
              href="/orders/new"
              className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Icon name="plus" size={15} />
              Nuevo pedido
            </Link>
            <Link
              href="/calendar"
              aria-label="Calendario de hoy"
              title="Calendario de hoy"
              className="flex h-10 w-10 items-center justify-center rounded-full text-soft transition-colors hover:bg-canvas hover:text-ink"
            >
              <Icon name="calendar" size={19} />
            </Link>
            <Suspense fallback={<BellLink count={null} active={active === "alerts"} tone="light" />}>
              <AlertsBell active={active === "alerts"} tone="light" />
            </Suspense>
            <span aria-hidden="true" className="h-8 w-px bg-hair" />
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-canvas">
                <span className="font-display flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  {initialsOf(actor.name)}
                </span>
                <span className="hidden leading-tight 2xl:block">
                  <span className="block max-w-36 truncate text-sm font-semibold">{actor.name}</span>
                  <span className="block text-[11px] text-muted">
                    <RoleLabel role={actor.role} />
                  </span>
                </span>
                <Icon name="down" size={14} className="text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 top-12 z-40 w-56 overflow-hidden rounded-md border border-hair bg-paper shadow-lg">
                <div className="border-b border-hair px-4 py-3 leading-tight">
                  <span className="block truncate text-sm font-semibold">{actor.name}</span>
                  <span className="block text-xs text-muted">
                    <RoleLabel role={actor.role} />
                  </span>
                </div>
                <Link href="/inicio" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-canvas">
                  <Icon name="home" size={15} /> Inicio
                </Link>
                <Link href="/alerts" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-canvas">
                  <Icon name="bell" size={15} /> Alertas
                </Link>
                <form action={logout} className="border-t border-hair">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-attention hover:bg-attention-soft"
                  >
                    <Icon name="logout" size={15} /> Cerrar sesión
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
