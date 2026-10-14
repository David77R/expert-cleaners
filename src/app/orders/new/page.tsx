import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { technicians as techniciansTable } from "@/db/schema";
import { toFormService, type FormTechnician } from "@/domain/appointment-form";
import { todayIn } from "@/domain/date-rules";
import { AppShell } from "@/components/app-header";
import { OrderBuilder } from "@/components/order-builder";
import { getActor } from "@/server/auth";
import { listServices } from "@/server/services";

export default async function NewOrderPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const db = getDb();
  const services = (await listServices(db)).map(toFormService);
  const technicians: FormTechnician[] = (await db.select().from(techniciansTable))
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
        </div>
        <OrderBuilder services={services} technicians={technicians} today={todayIn()} />
      </main>
    </AppShell>
  );
}
