import { redirect } from "next/navigation";
import { listTechnicians } from "@/server/technicians";
import { z } from "zod";
import { getDb } from "@/db/client";
import { emptyAppointmentForm, toFormService, type FormService, type FormTechnician } from "@/domain/appointment-form";
import { minutesToTimeInput, parseTimeInput } from "@/domain/appointment-panel";
import { todayIn } from "@/domain/date-rules";
import { isoDate } from "@/domain/schemas";
import { calendarHref } from "@/lib/calendar-links";
import { AppShell } from "@/components/app-header";
import { AppointmentForm } from "@/components/appointment-form";
import { BackLink } from "@/components/back-link";
import { getActor, getBrand } from "@/server/auth";
import { getCustomerSummary } from "@/server/customers";
import { listServices } from "@/server/services";
import { hidePhone } from "@/domain/phone-privacy";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewAppointmentPage({ searchParams }: PageProps<"/appointments/new">) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const params = await searchParams;
  const db = getDb();

  const requestedDate = isoDate.safeParse(first(params.date));
  const date = requestedDate.success ? requestedDate.data : todayIn();
  const startMin = parseTimeInput(first(params.time));
  const time = startMin === null ? "" : minutesToTimeInput(startMin);

  const serviceRows = await listServices(db, actor.companyId);
  const services: FormService[] = serviceRows.map(toFormService);

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
  const requestedTech = z.uuid().safeParse(first(params.tech));
  const technicianId =
    requestedTech.success && technicians.some((t) => t.id === requestedTech.data) ? requestedTech.data : "";

  const requestedCustomer = z.uuid().safeParse(first(params.customer));
  const summary = requestedCustomer.success
    ? await getCustomerSummary(db, actor.companyId, requestedCustomer.data)
    : null;
  const customer = summary ? hidePhone(actor, summary) : null;

  const initialValues = {
    ...emptyAppointmentForm((await getBrand()).location.state),
    date,
    time,
    technicianId,
    customerId: customer?.id ?? "",
    addressId: customer?.addresses[0]?.id ?? "",
  };

  return (
    <AppShell active="calendar" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <BackLink fallback={calendarHref({ date })} />
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Nueva cita</h1>
          <p className="text-sm text-soft">Elige el cliente, el servicio y el horario del técnico.</p>
        </div>
        <AppointmentForm
          services={services}
          technicians={technicians}
          initialCustomer={customer}
          initialValues={initialValues}
        />
      </main>
    </AppShell>
  );
}
