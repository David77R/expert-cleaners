import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { emptyTechnicianForm, suggestColor } from "@/domain/technician-form";
import { AppShell } from "@/components/app-header";
import { Icon } from "@/components/icons";
import { TechnicianForm } from "@/components/technician-form";
import { getActor } from "@/server/auth";
import { listTechnicians } from "@/server/technicians";

export default async function NewTechnicianPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "admin") redirect("/calendar");

  const technicians = await listTechnicians(getDb());
  const color = suggestColor(technicians.filter((t) => t.active).map((t) => t.color));

  return (
    <AppShell active="technicians" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <Link
          href="/technicians"
          className="flex w-fit items-center gap-1 text-sm font-medium text-soft hover:text-ink"
        >
          <Icon name="left" /> Todos los técnicos
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Nuevo técnico</h1>
          <p className="text-sm text-soft">Su zona, su color en el calendario y su horario de trabajo.</p>
        </div>
        <TechnicianForm initialValues={emptyTechnicianForm(color)} />
      </main>
    </AppShell>
  );
}
