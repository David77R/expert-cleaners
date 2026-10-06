"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { getDay } from "@/server/appointments";
import { DayGrid } from "@/components/day-grid";
import { AppointmentPanel } from "@/components/appointment-panel";

type Day = Awaited<ReturnType<typeof getDay>>;
type Technician = Day["appointments"][number]["technician"];

export function CalendarBoard({ day, technicians }: { day: Day; technicians: Technician[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <DayGrid day={day} technicians={technicians} onSelect={setSelectedId} />
      {selectedId && (
        <AppointmentPanel
          key={selectedId}
          appointmentId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </>
  );
}
