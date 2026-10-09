import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { technicians as techniciansTable } from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { parseView, summarize, viewRange } from "@/domain/calendar-view";
import { minutesNowIn, todayIn } from "@/domain/date-rules";
import { isoDate } from "@/domain/schemas";
import { AppShell } from "@/components/app-header";
import { AppointmentPanel } from "@/components/appointment-panel";
import { CalendarLegend } from "@/components/calendar-legend";
import { CalendarNotice } from "@/components/calendar-notice";
import { CalendarSummary } from "@/components/calendar-summary";
import { CalendarToolbar } from "@/components/calendar-toolbar";
import { DayGrid } from "@/components/day-grid";
import { MonthView } from "@/components/month-view";
import { WeekView } from "@/components/week-view";
import { getAppointment, getDay, getRange } from "@/server/appointments";
import { getActor } from "@/server/auth";
import { panelPhotos } from "@/server/photos";
import { getPhotoStorage } from "@/server/storage";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const params = await searchParams;
  const today = todayIn();
  const parsedDate = isoDate.safeParse(first(params.date) ?? today);
  if (!parsedDate.success) notFound();
  const date = parsedDate.data;
  const view = parseView(first(params.view));
  const nowMin = date === today ? minutesNowIn() : null;

  const db = getDb();
  const allTechnicians = (await db.select().from(techniciansTable)).filter((t) => t.active);
  const requested = z.uuid().safeParse(first(params.tech));
  const tech = requested.success && allTechnicians.some((t) => t.id === requested.data) ? requested.data : null;
  const visibleTechnicians = tech ? allTechnicians.filter((t) => t.id === tech) : allTechnicians;
  const nav = { view, date, tech };

  const data =
    view === "day"
      ? await getDay(db, date, tech ?? undefined)
      : await getRange(db, { ...viewRange(view, date), technicianId: tech ?? undefined });
  const summary = summarize(data.appointments, data.overlapIds);

  const requestedAppointment = z.uuid().safeParse(first(params.appt));
  let selected: Awaited<ReturnType<typeof getAppointment>> | null = null;
  if (requestedAppointment.success) {
    try {
      selected = await getAppointment(db, requestedAppointment.data);
    } catch (error) {
      if (!(error instanceof DomainError && error.code === "not_found")) throw error;
    }
  }
  const selectedId = selected?.id ?? null;
  const photos = selected ? await panelPhotos(db, getPhotoStorage, actor, selected.id) : null;

  return (
    <AppShell active="calendar" actor={actor}>
      <main
        className={`mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8 ${
          selected ? "2xl:pr-[26rem]" : ""
        }`}
      >
        <CalendarToolbar view={view} date={date} today={today} tech={tech} technicians={allTechnicians} />
        <CalendarSummary summary={summary} />

        {view === "day" && (
          <DayGrid
            appointments={data.appointments}
            overlapIds={data.overlapIds}
            technicians={visibleTechnicians}
            nav={nav}
            selectedId={selectedId}
            nowMin={nowMin}
          />
        )}
        {view === "day" && (
          <p className="-mt-3 hidden text-xs text-muted md:block">
            Arrastra una cita a otra hora o a otro técnico para moverla. Siempre se pide confirmación.
          </p>
        )}
        {view === "week" && (
          <WeekView
            nav={nav}
            today={today}
            appointments={data.appointments}
            overlapIds={data.overlapIds}
            selectedId={selectedId}
          />
        )}
        {view === "month" && (
          <MonthView nav={nav} today={today} appointments={data.appointments} overlapIds={data.overlapIds} />
        )}

        <CalendarLegend technicians={allTechnicians} />
      </main>

      <CalendarNotice />

      {selected && photos && (
        <AppointmentPanel appointment={selected} technicians={allTechnicians} nav={nav} photos={photos} />
      )}
    </AppShell>
  );
}
