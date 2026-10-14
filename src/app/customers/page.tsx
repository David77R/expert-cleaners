import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { formatPhone } from "@/domain/customer-rules";
import { customerSearchSchema, type CustomerSort } from "@/domain/schemas";
import { AppShell } from "@/components/app-header";
import { CustomerAvatar } from "@/components/customer-avatar";
import { INPUT } from "@/components/form-kit";
import { Icon } from "@/components/icons";
import { SearchBox } from "@/components/search-box";
import { getActor } from "@/server/auth";
import { searchCustomers } from "@/server/customers";

const PAGE_SIZE = 20;
const RECENT_COUNT = 5;

const SORT_LABELS: Record<CustomerSort, string> = {
  recent: "Más recientes primero",
  oldest: "Más antiguos primero",
  code_asc: "Código (menor a mayor)",
  code_desc: "Código (mayor a menor)",
  first_asc: "Nombre (A–Z)",
  first_desc: "Nombre (Z–A)",
  last_asc: "Apellido (A–Z)",
  last_desc: "Apellido (Z–A)",
};

const CREATED = new Intl.DateTimeFormat("es-US", {
  timeZone: "America/New_York",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const SELECT = `${INPUT} py-2`;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const params = await searchParams;
  const raw = {
    q: first(params.q).slice(0, 80),
    sort: first(params.sort) || "recent",
    city: first(params.city),
    marketing: first(params.marketing) || "any",
    appointments: first(params.appointments) || "any",
    createdFrom: first(params.createdFrom),
    createdTo: first(params.createdTo),
  };
  const filters = customerSearchSchema.parse(raw);
  const requestedOffset = Number(first(params.offset));
  const offset = Number.isInteger(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;
  const deleted = first(params.aviso) === "eliminado";

  const filtersActive = Boolean(
    filters.city ||
    filters.marketing !== "any" ||
    filters.appointments !== "any" ||
    filters.createdFrom ||
    filters.createdTo,
  );
  const browsing = Boolean(filters.q) || filtersActive || first(params.todos) === "1" || first(params.sort) !== "";

  const { items, hasMore, total } = await searchCustomers(getDb(), {
    ...filters,
    limit: browsing ? PAGE_SIZE : RECENT_COUNT,
    offset: browsing ? offset : 0,
  });

  function href(overrides: Record<string, string | number | undefined>): string {
    const next = new URLSearchParams();
    const merged: Record<string, string | number | undefined> = {
      q: filters.q,
      sort: filters.sort === "recent" ? undefined : filters.sort,
      city: filters.city,
      marketing: filters.marketing === "any" ? undefined : filters.marketing,
      appointments: filters.appointments === "any" ? undefined : filters.appointments,
      createdFrom: filters.createdFrom,
      createdTo: filters.createdTo,
      todos: "1",
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== "" && value !== 0) next.set(key, String(value));
    }
    return `/customers?${next.toString()}`;
  }

  const heading = !browsing
    ? "Clientes recientes"
    : filters.q
      ? `${total} ${total === 1 ? "resultado" : "resultados"} para «${filters.q}»`
      : `${total} ${total === 1 ? "cliente" : "clientes"}`;

  return (
    <AppShell active="customers" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Clientes</h1>
            <p className="text-sm text-soft">Busca por nombre, teléfono, correo o código de cliente.</p>
          </div>
          <Link
            href="/customers/new"
            className="flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Icon name="plus" />
            Nuevo cliente
          </Link>
        </div>

        {deleted && (
          <p role="status" className="rounded-md bg-success-soft px-4 py-3 text-sm font-medium text-success">
            Cliente eliminado.
          </p>
        )}

        <div className="flex flex-col gap-3">
          <SearchBox initial={filters.q} placeholder="Ej: María, 305 555, CLI-1001" />

          <form action="/customers" className="flex flex-col gap-3">
            {filters.q && <input type="hidden" name="q" value={filters.q} />}
            <input type="hidden" name="todos" value="1" />
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                Ordenar por
                <select name="sort" defaultValue={filters.sort} className={`${SELECT} min-w-52`}>
                  {Object.entries(SORT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <details className="group" open={filtersActive}>
                <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-hair bg-paper px-3.5 py-2.5 text-sm font-semibold text-soft hover:text-ink">
                  Filtros
                  {filtersActive && <span className="h-2 w-2 rounded-full bg-brand" aria-label="Hay filtros activos" />}
                  <Icon name="down" size={14} className="transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3 grid gap-3 rounded-md border border-hair bg-paper p-4 sm:grid-cols-2 lg:grid-cols-5">
                  <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                    Ciudad
                    <input name="city" defaultValue={filters.city} placeholder="Ej: Doral" className={SELECT} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                    Citas
                    <select name="appointments" defaultValue={filters.appointments} className={SELECT}>
                      <option value="any">Todos</option>
                      <option value="with">Con citas</option>
                      <option value="without">Sin citas</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                    Promociones
                    <select name="marketing" defaultValue={filters.marketing} className={SELECT}>
                      <option value="any">Todos</option>
                      <option value="yes">Aceptan promociones</option>
                      <option value="no">No aceptan</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                    Creados desde
                    <input type="date" name="createdFrom" defaultValue={filters.createdFrom ?? ""} className={SELECT} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                    Creados hasta
                    <input type="date" name="createdTo" defaultValue={filters.createdTo ?? ""} className={SELECT} />
                  </label>
                </div>
              </details>
              <button
                type="submit"
                className="rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Aplicar
              </button>
              {(filtersActive || filters.sort !== "recent") && (
                <Link
                  href={filters.q ? `/customers?q=${encodeURIComponent(filters.q)}` : "/customers?todos=1"}
                  className="px-2 py-2.5 text-sm font-medium text-soft hover:text-ink"
                >
                  Quitar filtros
                </Link>
              )}
            </div>
          </form>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{heading}</h2>
          {!browsing && total > items.length && (
            <Link href="/customers?todos=1" className="text-sm font-semibold text-brand-ink hover:underline">
              Ver todos los clientes ({total})
            </Link>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-hair bg-paper px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-canvas text-muted">
              <Icon name="search" size={22} />
            </span>
            <p className="font-medium">
              {filters.q
                ? `Sin resultados para «${filters.q}»`
                : filtersActive
                  ? "Ningún cliente cumple estos filtros"
                  : "Todavía no hay clientes"}
            </p>
            <p className="max-w-sm text-sm text-soft">
              {filters.q || filtersActive
                ? "Prueba con otra parte del nombre, los últimos dígitos del teléfono, el código o quita algún filtro."
                : "Cuando se registren clientes aparecerán aquí."}
            </p>
            {!filters.q && !filtersActive && (
              <Link
                href="/customers/new"
                className="mt-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Crear el primer cliente
              </Link>
            )}
          </div>
        ) : (
          <ul className="overflow-hidden rounded-md border border-hair bg-paper">
            {items.map((customer) => {
              const fullName = `${customer.firstName} ${customer.lastName}`;
              const cities = [...new Set(customer.addresses.map((a) => a.city))];
              return (
                <li key={customer.id} className="border-b border-hair last:border-b-0">
                  <Link
                    href={`/customers/${customer.id}`}
                    className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-brand-soft/40 sm:px-5"
                  >
                    <CustomerAvatar name={fullName} seed={customer.code} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{fullName}</span>
                        <span className="font-display rounded-[3px] bg-canvas px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-soft">
                          {customer.code}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-soft">
                        <span className="flex items-center gap-1.5 tabular-nums">
                          <Icon name="phone" size={12} />
                          {formatPhone(customer.phone)}
                        </span>
                        {customer.email && (
                          <span className="flex min-w-0 items-center gap-1.5">
                            <Icon name="mail" size={12} />
                            <span className="truncate">{customer.email}</span>
                          </span>
                        )}
                        <span className="text-muted">Creado {CREATED.format(customer.createdAt)}</span>
                      </span>
                    </span>
                    <span className="hidden shrink-0 rounded-[3px] bg-canvas px-2.5 py-1 text-xs font-medium tabular-nums text-soft sm:inline">
                      {customer.appointmentCount} {customer.appointmentCount === 1 ? "cita" : "citas"}
                    </span>
                    <span className="hidden shrink-0 items-center gap-1.5 rounded-[3px] bg-info-soft px-2.5 py-1 text-xs font-medium text-info md:flex">
                      <Icon name="pin" size={12} />
                      {customer.addresses.length} {customer.addresses.length === 1 ? "dirección" : "direcciones"}
                      {cities.length > 0 && <span className="font-normal">· {cities.slice(0, 2).join(", ")}</span>}
                    </span>
                    <Icon name="right" className="shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {browsing && (offset > 0 || hasMore) && (
          <nav aria-label="Paginación" className="flex items-center justify-between text-sm">
            {offset > 0 ? (
              <Link
                href={href({ offset: Math.max(0, offset - PAGE_SIZE) })}
                className="flex items-center gap-1.5 rounded-md border border-hair bg-paper px-3.5 py-2 font-medium text-soft hover:bg-canvas"
              >
                <Icon name="left" /> Anteriores
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted">
              {offset + 1} – {offset + items.length} de {total}
            </span>
            {hasMore ? (
              <Link
                href={href({ offset: offset + PAGE_SIZE })}
                className="flex items-center gap-1.5 rounded-md border border-hair bg-paper px-3.5 py-2 font-medium text-soft hover:bg-canvas"
              >
                Siguientes <Icon name="right" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </main>
    </AppShell>
  );
}
