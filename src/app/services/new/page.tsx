import { redirect } from "next/navigation";
import { isAdmin } from "@/domain/permissions";
import { getDb } from "@/db/client";
import { emptyServiceForm } from "@/domain/service-form";
import { AppShell } from "@/components/app-header";
import { BackLink } from "@/components/back-link";
import { ServiceForm } from "@/components/service-form";
import { getActor } from "@/server/auth";
import { listServices } from "@/server/services";

export default async function NewServicePage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!isAdmin(actor)) redirect("/calendar");

  const services = await listServices(getDb(), actor.companyId, { includeInactive: "true" }, actor);
  const categories = [...new Set(services.map((service) => service.category))].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <AppShell active="services" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <BackLink fallback="/orders/new" />
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Nuevo servicio</h1>
          <p className="text-sm text-soft">Define el precio, la duración y qué datos se piden al agendarlo.</p>
        </div>
        <ServiceForm initialValues={emptyServiceForm()} categories={categories} lockTwoAddresses={false} />
      </main>
    </AppShell>
  );
}
