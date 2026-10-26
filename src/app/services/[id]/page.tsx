import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/domain/permissions";
import { z } from "zod";
import { getDb } from "@/db/client";
import { serviceFormFromService } from "@/domain/service-form";
import { AppShell } from "@/components/app-header";
import { BackLink } from "@/components/back-link";
import { DeleteServiceButton } from "@/components/delete-service-button";
import { ServiceForm } from "@/components/service-form";
import { getActor } from "@/server/auth";
import { countServiceAppointments, getService, listServices } from "@/server/services";

export default async function EditServicePage({ params }: PageProps<"/services/[id]">) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!isAdmin(actor)) redirect("/calendar");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const db = getDb();
  const service = await getService(db, actor.companyId, id).catch(() => null);
  if (!service) notFound();

  const [all, used] = await Promise.all([
    listServices(db, actor.companyId, { includeInactive: "true" }, actor),
    countServiceAppointments(db, id),
  ]);
  const categories = [...new Set(all.map((item) => item.category))].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <AppShell active="services" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <BackLink fallback="/orders/new" />
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{service.name}</h1>
            <DeleteServiceButton serviceId={service.id} serviceName={service.name} />
          </div>
          <p className="text-sm text-soft">
            {used === 0 ? "Todavía sin citas." : used === 1 ? "1 cita registrada." : `${used} citas registradas.`} Los
            cambios de precio y duración aplican a las citas nuevas; las existentes conservan su precio.
          </p>
        </div>
        <ServiceForm
          serviceId={service.id}
          initialValues={serviceFormFromService(service)}
          categories={categories}
          lockTwoAddresses={used > 0}
        />
      </main>
    </AppShell>
  );
}
