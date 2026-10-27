import { getDb } from "@/db/client";
import { todayIn } from "@/domain/date-rules";
import { CarMotion } from "@/components/car-motion";
import { Icon } from "@/components/icons";
import { PreviewLink } from "@/components/preview-link";
import { activeServicesToday } from "@/server/appointments";

export function ActiveServicesLink({
  count,
  tone,
  vehicles,
}: {
  count: number | null;
  tone: "light" | "dark";
  vehicles: boolean;
}) {
  const label = count === null ? "Servicios activos hoy" : `Servicios activos hoy: ${count === 0 ? "ninguno" : count}`;
  return (
    <PreviewLink
      section="active"
      href="/calendar"
      aria-label={label}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
        tone === "light"
          ? "text-soft hover:bg-canvas hover:text-ink"
          : "text-rail-text hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {vehicles ? <CarMotion size={24} moving={Boolean(count)} /> : <Icon name="truck" size={20} />}
      {count !== null && count > 0 && (
        <span className="font-display absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold tabular-nums text-white ring-2 ring-paper">
          {count > 99 ? "99+" : count}
        </span>
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-50 mt-2 hidden whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block group-focus-visible:block"
      >
        {label}
      </span>
    </PreviewLink>
  );
}

export async function ActiveServices({
  companyId,
  tone,
  vehicles,
}: {
  companyId: string;
  tone: "light" | "dark";
  vehicles: boolean;
}) {
  let count: number | null = null;
  try {
    count = await activeServicesToday(getDb(), companyId, todayIn());
  } catch (error) {
    console.error(error);
  }
  return <ActiveServicesLink count={count} tone={tone} vehicles={vehicles} />;
}
