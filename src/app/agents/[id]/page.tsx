import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/domain/permissions";
import { z } from "zod";
import { getDb } from "@/db/client";
import { deleteAgentAction } from "@/app/agents/actions";
import { AgentForm } from "@/components/agent-form";
import { AppShell } from "@/components/app-header";
import { BackLink } from "@/components/back-link";
import { Icon } from "@/components/icons";
import { agentActivity, getAgent } from "@/server/agents";
import { getActor } from "@/server/auth";
import { getUserAdmin } from "@/server/user-admin";

export default async function EditAgentPage({ params, searchParams }: PageProps<"/agents/[id]">) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!isAdmin(actor)) redirect("/calendar");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const db = getDb();
  const agent = await getAgent(db, getUserAdmin(), actor.companyId, id).catch(() => null);
  if (!agent) notFound();

  const activity = await agentActivity(db, id);
  const deleteFailed = (await searchParams).error === "no-eliminado";

  return (
    <AppShell active="agents" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <BackLink fallback="/agents" />
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{agent.name}</h1>
          <p className="text-sm text-soft">
            {activity === 0 ? "Todavía no ha trabajado en el sistema." : "Ya tiene trabajo registrado en el sistema."}
          </p>
        </div>

        {deleteFailed && (
          <p
            role="alert"
            className="max-w-3xl rounded-md bg-attention-soft px-3.5 py-2.5 text-sm font-medium text-attention"
          >
            No se pudo eliminar: este agente ya tiene trabajo registrado. Desmarca &quot;Acceso activo&quot; para
            quitarle el acceso.
          </p>
        )}

        <AgentForm
          agentId={agent.id}
          initialValues={{ name: agent.name, email: agent.email, password: "", active: agent.active }}
        />

        {activity === 0 && (
          <details className="group max-w-3xl rounded-md border border-hair bg-paper">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 text-sm font-semibold text-attention">
              Eliminar agente
              <Icon name="right" className="transition-transform group-open:rotate-90" />
            </summary>
            <form
              action={deleteAgentAction.bind(null, agent.id)}
              className="flex flex-col gap-3 border-t border-hair px-5 py-4"
            >
              <p className="text-sm text-soft">
                Se borra su cuenta definitivamente. Solo es posible porque todavía no ha trabajado en el sistema.
              </p>
              <button
                type="submit"
                className="w-fit rounded-md border border-attention/50 bg-paper px-4 py-2 text-sm font-semibold text-attention transition-colors hover:bg-attention-soft"
              >
                Sí, eliminar a {agent.name}
              </button>
            </form>
          </details>
        )}
      </main>
    </AppShell>
  );
}
