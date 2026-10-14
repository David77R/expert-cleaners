import Link from "next/link";
import { ServiceIcon } from "@/components/service-icon";
import { serviceIconOf } from "@/domain/service-icons";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import type { Service } from "@/db/schema";
import { describeFieldCount, groupByCategory } from "@/domain/service-form";
import { formatMoney } from "@/domain/invoice";
import { AppShell } from "@/components/app-header";
import { Icon } from "@/components/icons";
import { getActor } from "@/server/auth";
import { listServices } from "@/server/services";

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function ServiceRow({ service, muted = false }: { service: Service; muted?: boolean }) {
  return (
    <li>
      <Link
        href={`/services/${service.id}`}
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-canvas/70"
      >
        <span className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
            <ServiceIcon icon={serviceIconOf(service)} size={24} />
          </span>
          <span className="min-w-0">
            <span className={`block truncate font-medium ${muted ? "text-soft" : ""}`}>{service.name}</span>
            <span className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-soft">
              <span>{describeFieldCount(service.fields.length)}</span>
              {service.twoAddresses && <span>Dos direcciones</span>}
            </span>
          </span>
        </span>
        <span className="flex items-baseline gap-5 text-sm tabular-nums">
          <span className="text-soft">{service.durationMin} min</span>
          <span className="font-display w-20 text-right text-base font-semibold">
            {formatMoney(service.basePriceCents)}
          </span>
          <Icon name="right" className="self-center text-muted" />
        </span>
      </Link>
    </li>
  );
}

function Groups({ services, muted = false }: { services: Service[]; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      {groupByCategory(services).map(([category, items]) => (
        <section key={category} className="overflow-hidden rounded-md border border-hair bg-paper">
          <h2 className="font-display border-b border-hair bg-canvas/60 px-5 py-2.5 text-sm font-semibold text-soft">
            {category}
          </h2>
          <ul className="divide-y divide-hair">
            {items.map((service) => (
              <ServiceRow key={service.id} service={service} muted={muted} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default async function ServicesPage({ searchParams }: PageProps<"/services">) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "admin") redirect("/calendar");

  const params = await searchParams;
  const services = await listServices(getDb(), { includeInactive: "true" }, actor);
  const active = services.filter((service) => service.active);
  const inactive = services.filter((service) => !service.active);

  const aviso = first(params.aviso);
  const saved = services.find((service) => service.id === first(params.id));
  const banner =
    saved && (aviso === "creado" || aviso === "actualizado")
      ? `${aviso === "creado" ? "Servicio creado" : "Cambios guardados"}: ${saved.name}.`
      : null;

  return (
    <AppShell active="services" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Servicios</h1>
            <p className="text-sm text-soft">Precios, duración y los datos que se piden al agendar cada servicio.</p>
          </div>
          <Link
            href="/services/new"
            className="flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Icon name="plus" />
            Nuevo servicio
          </Link>
        </div>

        {banner && (
          <p role="status" className="rounded-md bg-success-soft px-4 py-3 text-sm font-medium text-success">
            {banner}
          </p>
        )}

        {active.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-hair bg-paper px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-canvas text-muted">
              <Icon name="tag" size={22} />
            </span>
            <p className="font-display text-lg font-semibold">Todavía no hay servicios activos</p>
            <p className="max-w-sm text-sm text-soft">Crea el primero para poder agendar citas.</p>
          </div>
        ) : (
          <Groups services={active} />
        )}

        {inactive.length > 0 && (
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">No disponibles</h2>
              <p className="text-sm text-soft">No aparecen al agendar, pero las citas anteriores se conservan.</p>
            </div>
            <Groups services={inactive} muted />
          </div>
        )}
      </main>
    </AppShell>
  );
}
