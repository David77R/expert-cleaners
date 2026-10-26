import Link from "next/link";
import { isAdmin } from "@/domain/permissions";
import { listTechnicians } from "@/server/technicians";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { toFormService, type FormTechnician } from "@/domain/appointment-form";
import { todayIn } from "@/domain/date-rules";
import { AppShell } from "@/components/app-header";
import { OrderBuilder } from "@/components/order-builder";
import { getActor } from "@/server/auth";
import { listServices } from "@/server/services";

const NOTICES: Record<string, string> = {
  "servicio-creado": "Servicio creado.",
  "servicio-actualizado": "Servicio actualizado.",
  "servicio-eliminado": "Servicio eliminado.",
  "servicio-retirado": "Servicio eliminado. Las citas que ya lo tenían lo conservan.",
};

export default async function NewOrderPage({ searchParams }: PageProps<"/orders/new">) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const aviso = (await searchParams).aviso;
  const db = getDb();
  const services = (await listServices(db, actor.companyId)).map(toFormService);
  const technicians: FormTechnician[] = (await listTechnicians(db, actor.companyId))
    .filter((row) => row.active)
    .map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      zone: row.zone,
      shiftStartMin: row.shiftStartMin,
      shiftEndMin: row.shiftEndMin,
    }));

  return (
    <AppShell active="orders" actor={actor}>
      <main className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-5 px-4 py-6 md:px-8">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Nuevo pedido</h1>
          <p className="text-sm text-soft">
            Toca los servicios para armar el ticket, elige el cliente y programa la recogida y la entrega.
          </p>
          {isAdmin(actor) && (
            <Link href="/services" className="w-fit text-xs font-semibold text-brand-ink hover:underline">
              Ver todos los servicios, incluidos los inactivos
            </Link>
          )}
        </div>
        {typeof aviso === "string" && NOTICES[aviso] && (
          <p role="status" className="rounded-md bg-success-soft px-4 py-3 text-sm font-medium text-success">
            {NOTICES[aviso]}
          </p>
        )}
        <OrderBuilder services={services} technicians={technicians} today={todayIn()} isAdmin={isAdmin(actor)} />
      </main>
    </AppShell>
  );
}
