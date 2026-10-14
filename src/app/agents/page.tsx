import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/appointment-rules";
import { initialsOf } from "@/domain/calendar-view";
import { AppShell } from "@/components/app-header";
import { Icon } from "@/components/icons";
import { listAgents, type AgentView } from "@/server/agents";
import { getActor } from "@/server/auth";
import { getUserAdmin } from "@/server/user-admin";

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function AgentRow({ agent }: { agent: AgentView }) {
  return (
    <li>
      <Link
        href={`/agents/${agent.id}`}
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-canvas/70"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              agent.active ? "bg-brand-soft text-brand-ink" : "bg-neutral-soft text-muted"
            }`}
          >
            {initialsOf(agent.name)}
          </span>
          <span className="min-w-0">
            <span className={`block truncate font-medium ${agent.active ? "" : "text-soft"}`}>{agent.name}</span>
            <span className="block truncate text-sm text-soft">{agent.email || "Sin correo"}</span>
          </span>
        </span>
        <span className="flex items-center gap-4 text-sm">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              agent.active ? "bg-success-soft text-success" : "bg-neutral-soft text-muted"
            }`}
          >
            {agent.active ? "Activo" : "Sin acceso"}
          </span>
          <Icon name="right" className="text-muted" />
        </span>
      </Link>
    </li>
  );
}

export default async function AgentsPage({ searchParams }: PageProps<"/agents">) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "admin") redirect("/calendar");

  const params = await searchParams;
  let agents: AgentView[] = [];
  let setupError: string | null = null;
  try {
    agents = await listAgents(getDb(), getUserAdmin());
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    setupError = error.message;
  }

  const aviso = first(params.aviso);
  const saved = agents.find((agent) => agent.id === first(params.id));
  const banner =
    aviso === "eliminado"
      ? "Agente eliminado."
      : saved && (aviso === "creado" || aviso === "actualizado")
        ? `${aviso === "creado" ? "Agente creado" : "Cambios guardados"}: ${saved.name}.`
        : null;

  return (
    <AppShell active="agents" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Agentes</h1>
            <p className="text-sm text-soft">Las personas que agendan y atienden las citas en el sistema.</p>
          </div>
          {!setupError && (
            <Link
              href="/agents/new"
              className="flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Icon name="plus" />
              Nuevo agente
            </Link>
          )}
        </div>

        {banner && (
          <p role="status" className="rounded-md bg-success-soft px-4 py-3 text-sm font-medium text-success">
            {banner}
          </p>
        )}

        {setupError ? (
          <p role="alert" className="rounded-md bg-attention-soft px-4 py-3 text-sm font-medium text-attention">
            {setupError}
          </p>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-hair bg-paper px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-canvas text-muted">
              <Icon name="agent" size={22} />
            </span>
            <p className="font-display text-lg font-semibold">Todavía no hay agentes</p>
            <p className="max-w-sm text-sm text-soft">Crea el primero para que pueda iniciar sesión y agendar citas.</p>
          </div>
        ) : (
          <ul className="divide-y divide-hair overflow-hidden rounded-md border border-hair bg-paper">
            {agents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
