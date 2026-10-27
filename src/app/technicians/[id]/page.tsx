import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/domain/permissions";
import { z } from "zod";
import { getDb } from "@/db/client";
import { technicianFormFromTechnician } from "@/domain/technician-form";
import { deleteTechnicianAction } from "@/app/technicians/actions";
import { AppShell } from "@/components/app-header";
import { BackLink } from "@/components/back-link";
import { Icon } from "@/components/icons";
import { TechnicianForm } from "@/components/technician-form";
import { getActor } from "@/server/auth";
import { getTechnician, technicianUsage } from "@/server/technicians";
import { TechnicianAccessCard } from "@/components/technician-access-card";
import { getTechnicianAccess, type TechnicianAccess } from "@/server/technician-access";
import { getUserAdmin } from "@/server/user-admin";

function describeUsage(total: number, upcoming: number): string {
  if (total === 0) return "Todavía sin citas.";
  const totalText = total === 1 ? "1 cita registrada" : `${total} citas registradas`;
  if (upcoming === 0) return `${totalText}, ninguna pendiente.`;
  return `${totalText}, ${upcoming === 1 ? "1 pendiente" : `${upcoming} pendientes`}.`;
}

export default async function EditTechnicianPage({ params, searchParams }: PageProps<"/technicians/[id]">) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!isAdmin(actor)) redirect("/calendar");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const db = getDb();
  const technician = await getTechnician(db, actor.companyId, id).catch(() => null);
  if (!technician) notFound();

  const { total, upcoming } = await technicianUsage(db, id);
  const deleteFailed = (await searchParams).error === "no-eliminado";
  let access: TechnicianAccess = null;
  let accessProblem: string | null = null;
  try {
    access = await getTechnicianAccess(db, getUserAdmin(), actor.companyId, id);
  } catch (error) {
    accessProblem = error instanceof Error ? error.message : "No se pudo revisar el usuario del técnico.";
  }

  return (
    <AppShell active="technicians" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <BackLink fallback="/technicians" />
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{technician.name}</h1>
          <p className="text-sm text-soft">{describeUsage(total, upcoming)}</p>
        </div>

        {deleteFailed && (
          <p
            role="alert"
            className="max-w-3xl rounded-md bg-attention-soft px-3.5 py-2.5 text-sm font-medium text-attention"
          >
            No se pudo eliminar: este técnico ya tiene citas. Desmarca &quot;Disponible para agendar&quot; para
            ocultarlo.
          </p>
        )}

        <TechnicianForm technicianId={technician.id} initialValues={technicianFormFromTechnician(technician)} />

        {accessProblem ? (
          <p className="max-w-3xl rounded-md bg-warning-soft px-3.5 py-2.5 text-sm text-warning">{accessProblem}</p>
        ) : (
          <TechnicianAccessCard
            technicianId={technician.id}
            technicianName={technician.name}
            access={access && { email: access.email, active: access.active }}
          />
        )}

        {total === 0 && (
          <details className="group max-w-3xl rounded-md border border-hair bg-paper">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 text-sm font-semibold text-attention">
              Eliminar técnico
              <Icon name="right" className="transition-transform group-open:rotate-90" />
            </summary>
            <form
              action={deleteTechnicianAction.bind(null, technician.id)}
              className="flex flex-col gap-3 border-t border-hair px-5 py-4"
            >
              <p className="text-sm text-soft">
                Se borra definitivamente. Solo es posible porque todavía no tiene ninguna cita.
              </p>
              <button
                type="submit"
                className="w-fit rounded-md border border-attention/50 bg-paper px-4 py-2 text-sm font-semibold text-attention transition-colors hover:bg-attention-soft"
              >
                Sí, eliminar a {technician.name}
              </button>
            </form>
          </details>
        )}
      </main>
    </AppShell>
  );
}
