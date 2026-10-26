import { redirect } from "next/navigation";
import { isAdmin } from "@/domain/permissions";
import { emptyAgentForm } from "@/domain/agent-form";
import { AgentForm } from "@/components/agent-form";
import { AppShell } from "@/components/app-header";
import { BackLink } from "@/components/back-link";
import { getActor } from "@/server/auth";

export default async function NewAgentPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!isAdmin(actor)) redirect("/calendar");

  return (
    <AppShell active="agents" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <BackLink fallback="/agents" />
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Nuevo agente</h1>
          <p className="text-sm text-soft">Podrá entrar al sistema con este correo y la contraseña temporal.</p>
        </div>
        <AgentForm initialValues={emptyAgentForm()} />
      </main>
    </AppShell>
  );
}
