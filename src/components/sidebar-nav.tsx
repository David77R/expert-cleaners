"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { loadNavPreview, type NavPreviewResult } from "@/app/nav-preview/actions";
import { Icon, type IconName } from "@/components/icons";
import { ServiceIcon } from "@/components/service-icon";
import { initialsOf, readableOn } from "@/domain/calendar-view";
import { formatMoney } from "@/domain/invoice";
import type { NavPreview } from "@/domain/nav-preview";

export type SidebarLink = { key: string; href: string; label: string; icon: IconName };

const ROLE_NAMES = { owner: "Dueño", admin: "Administrador", agent: "Agente" } as const;

const SUBTITLES: Record<string, string> = {
  customers: "Lo más reciente de tu cartera",
  services: "Paquetes que se pueden agendar",
  agents: "Quién agenda en esta empresa",
  technicians: "Equipo y carga de hoy",
  reports: "Cómo va el mes",
  companies: "Empresas que administras",
};

function plainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`ml-auto h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white transition-opacity ${
        pending ? "animate-spin opacity-100" : "opacity-0"
      }`}
    />
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: ReactNode; tone?: "default" | "brand" }) {
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${tone === "brand" ? "border-brand/30 bg-brand-soft" : "border-hair bg-canvas/60"}`}>
      <span className="block text-xs font-medium text-soft">{label}</span>
      <span className="font-display mt-0.5 block text-2xl font-semibold tabular-nums leading-tight">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted first:mt-0">{children}</h3>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-hair px-4 py-5 text-center text-sm text-soft">{children}</p>;
}

function Row({ children, href, onGo }: { children: ReactNode; href?: string; onGo?: () => void }) {
  const className = "flex items-center gap-3 rounded-xl px-2.5 py-2.5";
  if (!href) return <li className={className}>{children}</li>;
  return (
    <li>
      <Link href={href} onClick={onGo} className={`${className} transition-colors hover:bg-canvas`}>
        {children}
        <Icon name="right" size={16} className="ml-auto shrink-0 text-muted" />
      </Link>
    </li>
  );
}

function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "brand" }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        tone === "brand" ? "bg-brand-soft text-brand-ink" : "bg-canvas text-soft"
      }`}
    >
      {children}
    </span>
  );
}

function Skeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="h-[70px] rounded-xl bg-canvas" />
        <div className="h-[70px] rounded-xl bg-canvas" />
      </div>
      <div className="mt-2 h-3 w-28 rounded bg-canvas" />
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex items-center gap-3 px-2.5 py-1.5">
          <div className="h-9 w-9 rounded-lg bg-canvas" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3 w-2/5 rounded bg-canvas" />
            <div className="h-2.5 w-1/4 rounded bg-canvas" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PreviewBody({ preview, onGo }: { preview: NavPreview; onGo: () => void }) {
  switch (preview.section) {
    case "customers":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Clientes" value={preview.total} />
            <Stat label="Nuevos este mes" value={preview.newThisMonth} tone="brand" />
          </div>
          <SectionTitle>Últimos registrados</SectionTitle>
          {preview.recent.length === 0 ? (
            <Empty>Todavía no hay clientes registrados.</Empty>
          ) : (
            <ul className="-mx-2.5 flex flex-col">
              {preview.recent.map((customer) => (
                <Row key={customer.id} href={`/customers/${customer.id}`} onGo={onGo}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-xs font-bold text-brand-ink">
                    {initialsOf(customer.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{customer.name}</span>
                    <span className="block truncate text-xs text-soft">
                      {customer.code} · {customer.phone}
                    </span>
                  </span>
                </Row>
              ))}
            </ul>
          )}
        </>
      );
    case "services":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Activos" value={preview.active} tone="brand" />
            <Stat label="Pausados" value={preview.inactive} />
          </div>
          <SectionTitle>Disponibles para agendar</SectionTitle>
          {preview.items.length === 0 ? (
            <Empty>No hay servicios activos.</Empty>
          ) : (
            <ul className="-mx-2.5 flex flex-col">
              {preview.items.map((service) => (
                <Row key={service.id} href={`/services/${service.id}`} onGo={onGo}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                    <ServiceIcon icon={service.icon} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{service.name}</span>
                    <span className="block text-xs text-soft">{service.durationMin} min</span>
                  </span>
                  <span className="font-display shrink-0 text-sm font-semibold tabular-nums">
                    {formatMoney(service.priceCents)}
                  </span>
                </Row>
              ))}
            </ul>
          )}
        </>
      );
    case "agents":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Activos" value={preview.items.filter((agent) => agent.active).length} tone="brand" />
            <Stat label="Inactivos" value={preview.items.filter((agent) => !agent.active).length} />
          </div>
          <SectionTitle>Equipo</SectionTitle>
          {preview.items.length === 0 ? (
            <Empty>Todavía no hay agentes en esta empresa.</Empty>
          ) : (
            <ul className="-mx-2.5 flex flex-col">
              {preview.items.map((agent) => (
                <Row key={agent.id} href={`/agents/${agent.id}`} onGo={onGo}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-bold text-soft">
                    {initialsOf(agent.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{agent.name}</span>
                    <span className="block text-xs text-soft">{ROLE_NAMES[agent.role]}</span>
                  </span>
                  {!agent.active && <Badge>Inactivo</Badge>}
                </Row>
              ))}
            </ul>
          )}
        </>
      );
    case "technicians": {
      const working = preview.items.filter((technician) => technician.active);
      const today = working.reduce((sum, technician) => sum + technician.today, 0);
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Técnicos activos" value={working.length} />
            <Stat label="Citas hoy" value={today} tone="brand" />
          </div>
          <SectionTitle>Hoy</SectionTitle>
          {preview.items.length === 0 ? (
            <Empty>Todavía no hay técnicos registrados.</Empty>
          ) : (
            <ul className="-mx-2.5 flex flex-col">
              {preview.items.map((technician) => (
                <Row key={technician.id} href={`/technicians/${technician.id}`} onGo={onGo}>
                  <span
                    className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ backgroundColor: technician.color, color: readableOn(technician.color) }}
                  >
                    {initialsOf(technician.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{technician.name}</span>
                    <span className="block truncate text-xs text-soft">{technician.zone}</span>
                  </span>
                  {technician.active ? (
                    <Badge tone={technician.today > 0 ? "brand" : "muted"}>
                      {technician.today === 1 ? "1 cita" : `${technician.today} citas`}
                    </Badge>
                  ) : (
                    <Badge>Inactivo</Badge>
                  )}
                </Row>
              ))}
            </ul>
          )}
        </>
      );
    }
    case "reports":
      return (
        <>
          <p className="mb-3 text-sm text-soft">
            Del {Number(preview.from.slice(8))} al {Number(preview.to.slice(8))} de este mes.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Agendadas" value={preview.scheduled} />
            <Stat label="Completadas" value={preview.completed} tone="brand" />
            <Stat label="Canceladas" value={preview.cancelled} />
          </div>
          <dl className="mt-3 grid grid-cols-3 divide-x divide-hair rounded-xl border border-hair text-center">
            {[
              ["Vendido", preview.bookedCents],
              ["Cobrado", preview.paidCents],
              ["Por cobrar", preview.unpaidCents],
            ].map(([label, cents]) => (
              <div key={label} className="px-2 py-2.5">
                <dt className="text-xs text-soft">{label}</dt>
                <dd className="font-display mt-0.5 text-sm font-semibold tabular-nums">{formatMoney(Number(cents))}</dd>
              </div>
            ))}
          </dl>
          <SectionTitle>Quién más vendió</SectionTitle>
          {preview.top.length === 0 ? (
            <Empty>Todavía no hay citas este mes.</Empty>
          ) : (
            <ul className="-mx-2.5 flex flex-col">
              {preview.top.map((agent, index) => (
                <Row key={agent.id}>
                  <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-semibold text-soft">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{agent.name}</span>
                    <span className="block text-xs text-soft">
                      {agent.scheduled === 1 ? "1 cita" : `${agent.scheduled} citas`}
                    </span>
                  </span>
                  <span className="font-display shrink-0 text-sm font-semibold tabular-nums">
                    {formatMoney(agent.bookedCents)}
                  </span>
                </Row>
              ))}
            </ul>
          )}
        </>
      );
    case "companies":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Empresas" value={preview.items.length} />
            <Stat label="Activas" value={preview.items.filter((company) => company.active).length} tone="brand" />
          </div>
          <SectionTitle>Todas</SectionTitle>
          <ul className="-mx-2.5 flex flex-col">
            {preview.items.map((company) => (
              <Row key={company.id} href={`/empresas/${company.id}`} onGo={onGo}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-soft">
                  <Icon name="building" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{company.name}</span>
                  <span className="block truncate text-xs text-soft">{company.label}</span>
                </span>
                {company.id === preview.currentId && <Badge tone="brand">Actual</Badge>}
                {!company.active && <Badge>Inactiva</Badge>}
              </Row>
            ))}
          </ul>
        </>
      );
  }
}

function PreviewModal({
  link,
  result,
  onClose,
  onGo,
}: {
  link: SidebarLink;
  result: NavPreviewResult | undefined;
  onClose: () => void;
  onGo: () => void;
}) {
  const primary = useRef<HTMLAnchorElement>(null);
  const closeRef = useRef(onClose);

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

  const titleId = `nav-preview-${link.key}`;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 backdrop-blur-[2px] sm:items-center sm:p-6">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="fixed inset-0 cursor-default" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="nav-preview-in relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-hair bg-paper shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center gap-3 border-b border-hair px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <Icon name={link.icon} size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-lg font-semibold leading-tight">
              {link.label}
            </h2>
            <span className="block text-sm text-soft">{SUBTITLES[link.key]}</span>
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
            href={link.href}
            onClick={onGo}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Ir a la pantalla de {link.label.toLowerCase()}
            <Icon name="right" size={16} />
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function SidebarNav({
  links,
  active,
  previews,
}: {
  links: SidebarLink[];
  active: string;
  previews: readonly string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, NavPreviewResult>>({});
  const navigating = leaving === pathname;
  const openLink = links.find((link) => link.key === openKey);

  function startLeaving() {
    setLeaving(pathname);
  }

  function openPreview(link: SidebarLink) {
    setOpenKey(link.key);
    router.prefetch(link.href);
    void loadNavPreview(link.key).then((result) => setResults((previous) => ({ ...previous, [link.key]: result })));
  }

  function onClick(event: MouseEvent<HTMLAnchorElement>, link: SidebarLink) {
    if (!plainClick(event) || link.key === active) return;
    if (previews.includes(link.key)) {
      event.preventDefault();
      openPreview(link);
      return;
    }
    startLeaving();
  }

  return (
    <>
      {navigating && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px]">
          <div className="nav-progress h-full bg-brand shadow-[0_0_10px_var(--brand)]" />
        </div>
      )}
      <nav
        aria-label="Principal"
        className="mt-5 flex flex-col gap-1 px-3 [@media(max-height:760px)]:mt-3 [@media(max-height:760px)]:gap-0.5"
      >
        {links.map((link) => {
          const current = link.key === active;
          const preview = previews.includes(link.key);
          return (
            <Link
              key={link.key}
              href={link.href}
              prefetch={preview ? false : undefined}
              aria-current={current ? "page" : undefined}
              aria-haspopup={preview && !current ? "dialog" : undefined}
              onClick={(event) => onClick(event, link)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors [@media(max-height:760px)]:py-2 ${
                current
                  ? "bg-brand/20 text-white ring-1 ring-inset ring-brand/40"
                  : openKey === link.key
                    ? "bg-white/[0.08] text-white"
                    : "text-rail-text hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icon name={link.icon} size={18} />
              {link.label}
              <PendingDot />
            </Link>
          );
        })}
      </nav>
      {openLink && (
        <PreviewModal
          link={openLink}
          result={results[openLink.key]}
          onClose={() => setOpenKey(null)}
          onGo={() => {
            setOpenKey(null);
            startLeaving();
          }}
        />
      )}
    </>
  );
}
