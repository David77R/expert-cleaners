import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { services as servicesTable, technicians as techniciansTable } from "@/db/schema";
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
import { MapViewLoader } from "@/components/map-view-loader";
import type { MapRouteDraft, MapServiceOption, MapStop, MapTechnicianOption } from "@/components/map-view";
import { MonthView } from "@/components/month-view";
import { WeekView } from "@/components/week-view";
import { getAppointment, getDay, getRange } from "@/server/appointments";
import { getActor } from "@/server/auth";
import { panelPhotos } from "@/server/photos";
import { listRouteDraftsForDay } from "@/server/route-drafts";
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
  const mapa = first(params.mapa) === "1";
  const nowMin = date === today ? minutesNowIn() : null;

  const db = getDb();
  const allTechnicians = (await db.select().from(techniciansTable)).filter((t) => t.active);
  const requested = z.uuid().safeParse(first(params.tech));
  const tech = requested.success && allTechnicians.some((t) => t.id === requested.data) ? requested.data : null;
  const visibleTechnicians = tech ? allTechnicians.filter((t) => t.id === tech) : allTechnicians;
  const nav = { view, date, tech };

  const data =
    view === "day" || mapa
      ? await getDay(db, date, tech ?? undefined)
      : await getRange(db, { ...viewRange(view, date), technicianId: tech ?? undefined });
  const summary = summarize(data.appointments, data.overlapIds);
  // En el Mapa no mostramos el aviso de "citas con solape": ese indicador es de choques de
  // horario del día normal, no de rutas, y ahí solo estorba la vista. Más adelante lo
  // reemplazamos por un aviso de conflictos de ruta propio del mapa.
  const summaryForDisplay = mapa ? { ...summary, overlaps: 0 } : summary;

  // El Mapa ignora el filtro de técnico de arriba: siempre considera todas las citas del día,
  // y son las casillas internas (Técnicos/Servicios) las que deciden qué se dibuja.
  const mapTechnicians: MapTechnicianOption[] = allTechnicians;
  let mapServices: MapServiceOption[] = [];
  let mapStops: MapStop[] = [];
  let mapDrafts: MapRouteDraft[] = [];
  let missingCoords = 0;

  if (mapa) {
    const mapData = tech ? await getDay(db, date) : data;
    mapServices = (await db.select().from(servicesTable)).filter((s) => s.active);
    mapDrafts = (await listRouteDraftsForDay(db, date)).map((d) => ({
      mode: d.mode as "tech" | "service",
      groupKey: d.groupKey,
      stopIds: d.stopIds,
      createdByName: d.createdByName,
      createdAt: d.createdAt.toISOString(),
    }));

    const activeMapAppointments = mapData.appointments.filter((a) => a.status !== "cancelled");
    mapStops = activeMapAppointments
      .filter((a) => a.address.lat != null && a.address.lng != null)
      .map((a) => ({
        id: a.id,
        code: a.code,
        startMin: a.startMin,
        durationMin: a.durationMin,
        customerName: `${a.customer.firstName} ${a.customer.lastName}`,
        lat: a.address.lat as number,
        lng: a.address.lng as number,
        technicianId: a.technician.id,
        technicianName: a.technician.name,
        technicianColor: a.technician.color,
        serviceId: a.service.id,
        serviceName: a.service.name,
        address: `${a.address.line1}${a.address.unit ? ` ${a.address.unit}` : ""}, ${a.address.city}, ${a.address.state} ${a.address.zip}`,
        notes: a.notes,
      }));
    missingCoords = activeMapAppointments.length - mapStops.length;
  }

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
        <CalendarToolbar view={view} date={date} today={today} tech={tech} technicians={allTechnicians} mapa={mapa} />
        <CalendarSummary summary={summaryForDisplay} />

        {mapa && (
          <>
            <MapViewLoader
              key={date}
              date={date}
              stops={mapStops}
              technicians={mapTechnicians}
              services={mapServices}
              drafts={mapDrafts}
            />
            {missingCoords > 0 && (
              <p className="-mt-1 text-xs text-muted">
                {missingCoords} cita{missingCoords === 1 ? "" : "s"} sin dirección geocodificada no aparece
                {missingCoords === 1 ? "" : "n"} en el mapa.
              </p>
            )}
          </>
        )}

        {!mapa && view === "day" && (
          <DayGrid
            appointments={data.appointments}
            overlapIds={data.overlapIds}
            technicians={visibleTechnicians}
            nav={nav}
            selectedId={selectedId}
            nowMin={nowMin}
          />
        )}
        {!mapa && view === "day" && (
          <p className="-mt-3 hidden text-xs text-muted md:block">
            Arrastra una cita a otra hora o a otro técnico para moverla. Siempre se pide confirmación.
          </p>
        )}
        {!mapa && view === "week" && (
          <WeekView
            nav={nav}
            today={today}
            appointments={data.appointments}
            overlapIds={data.overlapIds}
            selectedId={selectedId}
          />
        )}
        {!mapa && view === "month" && (
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
