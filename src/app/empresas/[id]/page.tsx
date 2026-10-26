import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { brandOf } from "@/domain/companies";
import { companyFormFrom } from "@/domain/company-form";
import { isOwner } from "@/domain/permissions";
import { AppShell, ROLE_LABEL } from "@/components/app-header";
import { BrandMark } from "@/components/brand-mark";
import { CompanyAdminForm } from "@/components/company-admin-form";
import { CompanyForm } from "@/components/company-form";
import { CompanyLogoForm } from "@/components/company-logo-form";
import { Icon } from "@/components/icons";
import { getActor } from "@/server/auth";
import { companyPeople, findCompany } from "@/server/companies";
import { getUserAdmin } from "@/server/user-admin";
import { removeLogoAction, switchCompanyAction } from "../actions";

const NOTICES: Record<string, string> = {
  creada: "Empresa creada. Ahora sube su logo y crea su primer administrador.",
  guardada: "Cambios guardados.",
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function CompanyPage({ params, searchParams }: PageProps<"/empresas/[id]">) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!isOwner(actor)) redirect("/inicio");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const company = await findCompany(db, id);
  if (!company) notFound();
  const brand = brandOf(company);
  const notice = NOTICES[first((await searchParams).aviso)];
  let people: Awaited<ReturnType<typeof companyPeople>> | null = null;
  try {
    people = await companyPeople(db, getUserAdmin(), actor, id);
  } catch (error) {
    console.error(error);
  }

  return (
    <AppShell active="companies" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Link
              href="/empresas"
              className="flex w-fit items-center gap-1 text-sm font-medium text-soft hover:text-ink"
            >
              <Icon name="left" size={15} /> Empresas
            </Link>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{company.name}</h1>
            <p className="text-sm text-soft">
              {brand.location.label}
              {brand.features.publicBooking && (
                <>
                  {" · "}
                  <a
                    href={`/reservar/${company.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-brand-ink underline"
                  >
                    /reservar/{company.slug}
                  </a>
                </>
              )}
            </p>
          </div>
          <form action={switchCompanyAction}>
            <input type="hidden" name="companyId" value={company.id} />
            <input type="hidden" name="next" value="/inicio" />
            <button
              type="submit"
              className="rounded-md border border-hair px-4 py-2.5 text-sm font-semibold hover:bg-canvas"
            >
              {company.id === actor.companyId ? "Ir al inicio de esta empresa" : "Abrir esta empresa"}
            </button>
          </form>
        </div>

        {notice && (
          <p role="status" className="rounded-md bg-success-soft px-4 py-3 text-sm font-medium text-success">
            {notice}
          </p>
        )}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,48rem)_minmax(0,1fr)]">
          <CompanyForm companyId={company.id} initialValues={companyFormFrom(company)} />

          <aside className="flex flex-col gap-5">
            <section className="flex flex-col gap-4 rounded-md border border-hair bg-paper p-5 sm:p-6">
              <h2 className="font-display text-lg font-semibold">Logo</h2>
              <div
                className="flex min-h-24 items-center justify-center rounded-md px-4 py-4"
                style={{ backgroundColor: brand.theme["--rail"] ?? brand.themeColor }}
              >
                <BrandMark brand={brand} size="lg" />
              </div>
              <CompanyLogoForm companyId={company.id} hasLogo={Boolean(brand.logo)} />
              {brand.logo && (
                <form action={removeLogoAction.bind(null, company.id)}>
                  <button type="submit" className="text-sm font-semibold text-attention hover:underline">
                    Quitar logo y usar las iniciales
                  </button>
                </form>
              )}
            </section>

            <section className="flex flex-col gap-4 rounded-md border border-hair bg-paper p-5 sm:p-6">
              <div>
                <h2 className="font-display text-lg font-semibold">Equipo</h2>
                <p className="mt-0.5 text-sm text-soft">
                  El administrador entra con su correo y crea a los agentes y técnicos desde dentro de la empresa.
                </p>
              </div>
              {people === null ? (
                <p className="text-sm text-attention">No se pudo leer el equipo desde Supabase Auth.</p>
              ) : people.length === 0 ? (
                <p className="rounded-md bg-canvas px-4 py-3 text-sm text-soft">
                  Todavía no hay nadie en esta empresa.
                </p>
              ) : (
                <ul className="divide-y divide-hair rounded-md border border-hair">
                  {people.map((person) => (
                    <li key={person.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span
                          className={`block truncate font-medium ${person.active ? "" : "text-muted line-through"}`}
                        >
                          {person.name}
                        </span>
                        <span className="block truncate text-xs text-soft">{person.email}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-soft">
                        {ROLE_LABEL[person.role]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <CompanyAdminForm companyId={company.id} />
            </section>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
