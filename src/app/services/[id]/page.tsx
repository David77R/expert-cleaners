import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { serviceFormFromService } from "@/domain/service-form";
import { AppShell } from "@/components/app-header";
import { Icon } from "@/components/icons";
import { ServiceForm } from "@/components/service-form";
import { getActor } from "@/server/auth";
import { countServiceAppointments, getService, listServices } from "@/server/services";

export default async function EditServicePage({ params }: PageProps<"/services/[id]">) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "admin") redirect("/calendar");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const db = getDb();
  const service = await getService(db, id).catch(() => null);
  if (!service) notFound();

  const [all, used] = await Promise.all([
    listServices(db, { includeInactive: "true" }, actor),
    countServiceAppointments(db, id),
  ]);
  const categories = [...new Set(all.map((item) => item.category))].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <AppShell active="services" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <Link href="/services" className="flex w-fit items-center gap-1 text-sm font-medium text-soft hover:text-ink">
          <Icon name="left" /> Todos los servicios
        </Link>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{service.name}</h1>
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
