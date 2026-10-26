import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { brandOf } from "@/domain/companies";
import { isOwner } from "@/domain/permissions";
import { AppShell } from "@/components/app-header";
import { BrandMark } from "@/components/brand-mark";
import { Icon } from "@/components/icons";
import { getActor } from "@/server/auth";
import { companyOverview } from "@/server/companies";
import { switchCompanyAction } from "./actions";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex flex-col">
      <span className="font-display text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-soft">{label}</span>
    </span>
  );
}

export default async function CompaniesPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!isOwner(actor)) redirect("/inicio");

  const companies = await companyOverview(getDb(), actor);

  return (
    <AppShell active="companies" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Empresas</h1>
            <p className="text-sm text-soft">
              Cada empresa tiene su propio equipo, clientes, citas y marca. Solo tú las ves todas.
            </p>
          </div>
          <Link
            href="/empresas/nueva"
            className="flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Icon name="plus" />
            Nueva empresa
          </Link>
        </div>

        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => {
            const brand = brandOf(company);
            const current = company.id === actor.companyId;
            return (
              <li
                key={company.id}
                className={`flex flex-col overflow-hidden rounded-md border bg-paper ${current ? "border-brand ring-1 ring-brand" : "border-hair"}`}
              >
                <div
                  className="flex min-h-24 items-center gap-3 px-5 py-4"
                  style={{ backgroundColor: brand.theme["--rail"] ?? brand.themeColor }}
                >
                  <BrandMark brand={brand} size={brand.logo ? "lg" : "md"} />
                  <span className="min-w-0 leading-tight text-white">
                    <span className="font-display block truncate text-base font-semibold">{company.name}</span>
                    <span className="block truncate text-xs opacity-75">{brand.location.label}</span>
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span
                      className={`rounded-full px-2.5 py-1 ${company.active ? "bg-success-soft text-success" : "bg-neutral-soft text-soft"}`}
                    >
                      {company.active ? "Activa" : "Desactivada"}
                    </span>
                    {current && (
                      <span className="rounded-full bg-brand-soft px-2.5 py-1 text-brand-ink">Abierta ahora</span>
                    )}
                    {brand.features.publicBooking && (
                      <span className="rounded-full bg-info-soft px-2.5 py-1 text-info">
                        Reserva en /reservar/{company.slug}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <Stat label="Usuarios" value={company.people} />
                    <Stat label="Técnicos" value={company.technicians} />
                    <Stat label="Clientes" value={company.customers} />
                    <Stat label="Citas" value={company.appointments} />
                  </div>
                  <div className="mt-auto flex gap-2">
                    <form action={switchCompanyAction} className="flex-1">
                      <input type="hidden" name="companyId" value={company.id} />
                      <input type="hidden" name="next" value="/inicio" />
                      <button
                        type="submit"
                        className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      >
                        {current ? "Ir al inicio" : "Abrir"}
                      </button>
                    </form>
                    <Link
                      href={`/empresas/${company.id}`}
                      className="flex items-center gap-1.5 rounded-md border border-hair px-4 py-2.5 text-sm font-semibold hover:bg-canvas"
                    >
                      <Icon name="pencil" size={15} />
                      Editar
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </AppShell>
  );
}
