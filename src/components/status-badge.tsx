import type { AppointmentStatus } from "@/db/schema";
import { STATUS_UI } from "@/lib/ui";

export function StatusBadge({ status, compact = false }: { status: AppointmentStatus; compact?: boolean }) {
  const ui = STATUS_UI[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-[3px] font-medium ${ui.badge} ${
        compact ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 ${status === "not_confirmed" ? "rounded-full border border-current" : "rounded-full"} ${status === "not_confirmed" ? "bg-transparent" : ui.dot}`}
      />
      {ui.label}
    </span>
  );
}
