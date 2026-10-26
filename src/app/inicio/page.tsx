import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { minutesNowIn, todayIn } from "@/domain/date-rules";
import { AppShell } from "@/components/app-header";
import { DashboardView } from "@/components/dashboard-view";
import { getActor, getBrand } from "@/server/auth";
import { getDashboard } from "@/server/dashboard";

export default async function DashboardPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const data = await getDashboard(getDb(), actor.companyId, todayIn());
  const brand = await getBrand();

  return (
    <AppShell active="home" actor={actor}>
      <DashboardView data={data} actorName={actor.name} now={minutesNowIn()} rugPickup={brand.features.rugPickup} />
    </AppShell>
  );
}
