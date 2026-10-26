import Link from "next/link";
import { cookies } from "next/headers";
import { SEEN_COOKIE, unseenCount } from "@/domain/alert-seen";
import { getDb } from "@/db/client";
import { Icon } from "@/components/icons";
import { getAlerts } from "@/server/alerts";

async function alertCount(companyId: string): Promise<number | null> {
  try {
    const { items } = await getAlerts(getDb(), companyId);
    return unseenCount(items, (await cookies()).get(SEEN_COOKIE)?.value);
  } catch (error) {
    console.error(error);
    return null;
  }
}

export function BellLink({ count, active, tone }: { count: number | null; active: boolean; tone: "light" | "dark" }) {
  const label =
    count === null || count === 0 ? "Alertas: nada nuevo" : `Alertas: ${count} ${count === 1 ? "nueva" : "nuevas"}`;
  return (
    <Link
      href="/alerts"
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
        tone === "light"
          ? active
            ? "bg-brand-soft text-brand-ink"
            : "text-soft hover:bg-canvas hover:text-ink"
          : active
            ? "bg-brand/20 text-white"
            : "text-rail-text hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <Icon name="bell" size={20} />
      {count !== null && count > 0 && (
        <span className="font-display absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-attention px-1 text-[11px] font-bold tabular-nums text-white ring-2 ring-paper">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export async function AlertsBell({
  companyId,
  active,
  tone,
}: {
  companyId: string;
  active: boolean;
  tone: "light" | "dark";
}) {
  return <BellLink count={await alertCount(companyId)} active={active} tone={tone} />;
}
