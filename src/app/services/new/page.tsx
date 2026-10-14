import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { emptyServiceForm } from "@/domain/service-form";
import { AppShell } from "@/components/app-header";
import { Icon } from "@/components/icons";
import { ServiceForm } from "@/components/service-form";
import { getActor } from "@/server/auth";
import { listServices } from "@/server/services";

export default async function NewServicePage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "admin") redirect("/calendar");

  const services = await listServices(getDb(), { includeInactive: "true" }, actor);
  const categories = [...new Set(services.map((service) => service.category))].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <AppShell active="services" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <Link href="/orders/new" className="flex w-fit items-center gap-1 text-sm font-medium text-soft hover:text-ink">
          <Icon name="left" /> Volver a Nuevo pedido
        </Link>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Nuevo servicio</h1>
          <p className="text-sm text-soft">Define el precio, la duración y qué datos se piden al agendarlo.</p>
        </div>
        <ServiceForm initialValues={emptyServiceForm()} categories={categories} lockTwoAddresses={false} />
      </main>
    </AppShell>
  );
}
