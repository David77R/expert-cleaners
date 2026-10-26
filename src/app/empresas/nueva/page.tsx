import Link from "next/link";
import { redirect } from "next/navigation";
import { isOwner } from "@/domain/permissions";
import { emptyCompanyForm } from "@/domain/company-form";
import { AppShell } from "@/components/app-header";
import { CompanyForm } from "@/components/company-form";
import { Icon } from "@/components/icons";
import { getActor } from "@/server/auth";

export default async function NewCompanyPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!isOwner(actor)) redirect("/inicio");

  return (
    <AppShell active="companies" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <div className="flex flex-col gap-1">
          <Link href="/empresas" className="flex w-fit items-center gap-1 text-sm font-medium text-soft hover:text-ink">
            <Icon name="left" size={15} /> Empresas
          </Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Nueva empresa</h1>
          <p className="text-sm text-soft">Después de crearla podrás subir el logo y crear su primer administrador.</p>
        </div>
        <CompanyForm initialValues={emptyCompanyForm()} />
      </main>
    </AppShell>
  );
}
