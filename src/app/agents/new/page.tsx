import Link from "next/link";
import { redirect } from "next/navigation";
import { emptyAgentForm } from "@/domain/agent-form";
import { AgentForm } from "@/components/agent-form";
import { AppShell } from "@/components/app-header";
import { Icon } from "@/components/icons";
import { getActor } from "@/server/auth";

export default async function NewAgentPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "admin") redirect("/calendar");

  return (
    <AppShell active="agents" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <Link href="/agents" className="flex w-fit items-center gap-1 text-sm font-medium text-soft hover:text-ink">
          <Icon name="left" /> Todos los agentes
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Nuevo agente</h1>
          <p className="text-sm text-soft">Podrá entrar al sistema con este correo y la contraseña temporal.</p>
        </div>
        <AgentForm initialValues={emptyAgentForm()} />
      </main>
    </AppShell>
  );
}
