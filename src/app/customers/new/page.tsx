import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-header";
import { CustomerForm } from "@/components/customer-form";
import { Icon } from "@/components/icons";
import { getActor } from "@/server/auth";

export default async function NewCustomerPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");

  return (
    <AppShell active="customers" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <Link href="/customers" className="flex w-fit items-center gap-1 text-sm font-medium text-soft hover:text-ink">
          <Icon name="left" /> Todos los clientes
        </Link>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[34px] font-semibold leading-none tracking-tight">Nuevo cliente</h1>
          <p className="text-sm text-soft">
            Registra los datos de contacto y la dirección donde se prestará el servicio.
          </p>
        </div>
        <CustomerForm />
      </main>
    </AppShell>
  );
}
