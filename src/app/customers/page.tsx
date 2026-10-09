import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { formatPhone } from "@/domain/customer-rules";
import { AppShell } from "@/components/app-header";
import { CustomerAvatar } from "@/components/customer-avatar";
import { Icon } from "@/components/icons";
import { SearchBox } from "@/components/search-box";
import { getActor } from "@/server/auth";
import { searchCustomers } from "@/server/customers";

const PAGE_SIZE = 20;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function pageHref(q: string, offset: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (offset > 0) params.set("offset", String(offset));
  const query = params.toString();
  return query ? `/customers?${query}` : "/customers";
}

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const params = await searchParams;
  const q = first(params.q).trim().slice(0, 80);
  const requestedOffset = Number(first(params.offset));
  const offset = Number.isInteger(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;

  const { items, hasMore } = await searchCustomers(getDb(), { q: q || undefined, limit: PAGE_SIZE, offset });

  return (
    <AppShell active="customers" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[34px] font-semibold leading-none tracking-tight">Clientes</h1>
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

        <SearchBox initial={q} placeholder="Ej: Andrés, 305 555, CLI-1001" />

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-hair bg-paper px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-canvas text-muted">
              <Icon name="search" size={22} />
            </span>
            <p className="font-medium">{q ? `Sin resultados para «${q}»` : "Todavía no hay clientes"}</p>
            <p className="max-w-sm text-sm text-soft">
              {q
                ? "Prueba con otra parte del nombre, con los últimos dígitos del teléfono o con el código."
                : "Cuando se registren clientes aparecerán aquí."}
            </p>
            {!q && (
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
                      </span>
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

        {(offset > 0 || hasMore) && (
          <nav aria-label="Paginación" className="flex items-center justify-between text-sm">
            {offset > 0 ? (
              <Link
                href={pageHref(q, Math.max(0, offset - PAGE_SIZE))}
                className="flex items-center gap-1.5 rounded-md border border-hair bg-paper px-3.5 py-2 font-medium text-soft hover:bg-canvas"
              >
                <Icon name="left" /> Anteriores
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted">
              {offset + 1} – {offset + items.length}
            </span>
            {hasMore ? (
              <Link
                href={pageHref(q, offset + PAGE_SIZE)}
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
