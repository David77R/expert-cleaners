import Link from "next/link";
import { companyServices } from "@/server/services";
import { listTechnicians } from "@/server/technicians";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/appointment-rules";
import { parseView, summarize, viewRange } from "@/domain/calendar-view";
import { minutesNowIn, todayIn } from "@/domain/date-rules";
import { serviceLabel } from "@/domain/appointment-items";
import { asDeliveryEntry, deliveryKey } from "@/domain/delivery";
import type { CalendarAppointment } from "@/components/calendar-types";
import { toFormService } from "@/domain/appointment-form";
import { isoDate } from "@/domain/schemas";
import { AppShell } from "@/components/app-header";
import { Icon } from "@/components/icons";
import { AppointmentPanel } from "@/components/appointment-panel";
import { CalendarLegend } from "@/components/calendar-legend";
import { CalendarNotice } from "@/components/calendar-notice";
import { CalendarSummary } from "@/components/calendar-summary";
import { CalendarToolbar } from "@/components/calendar-toolbar";
import { DayGrid } from "@/components/day-grid";
import { MapViewLoader } from "@/components/map-view-loader";
import { appointmentNeedsPickup } from "@/domain/pickup";
import { STATUS_FILTERS, matchesStatusFilter, parseStatusFilter } from "@/domain/status-filter";
import { formatMinutes } from "@/domain/appointment-rules";
import { formatDayLabel, initialsOf, readableOn } from "@/domain/calendar-view";
import { hasDelivery } from "@/domain/delivery";
import { calendarHref } from "@/lib/calendar-links";
import type { MapRouteDraft, MapServiceOption, MapStop, MapTechnicianOption } from "@/components/map-view";
import { MonthView } from "@/components/month-view";
import { WeekView } from "@/components/week-view";
import { conflictingAppointments, getAppointment, getDay, getDeliveries, getRange } from "@/server/appointments";
import { getActor, getBrand } from "@/server/auth";
import { locateMissingAddresses } from "@/server/customers";
import { panelPhotos } from "@/server/photos";
import { listRouteDraftsForDay } from "@/server/route-drafts";
import { getPhotoStorage } from "@/server/storage";
import { listVehicles } from "@/server/vehicles";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const brand = await getBrand();

  const params = await searchParams;
  const today = todayIn();
  const parsedDate = isoDate.safeParse(first(params.date) ?? today);
  if (!parsedDate.success) notFound();
  const date = parsedDate.data;
  const view = parseView(first(params.view));
  const mapa = first(params.mapa) === "1";
  const entregas = first(params.entregas) !== "0";
  const nowMin = date === today ? minutesNowIn() : null;

  const db = getDb();
  const allTechnicians = (await listTechnicians(db, actor.companyId)).filter((t) => t.active);
  const requested = z.uuid().safeParse(first(params.tech));
  const tech = requested.success && allTechnicians.some((t) => t.id === requested.data) ? requested.data : null;
  const estado = parseStatusFilter(first(params.estado));
  const nav = { view, date, tech, entregas, estado };

  const data =
    view === "day" || mapa
      ? await getDay(db, actor.companyId, date, tech ?? undefined)
      : await getRange(db, actor.companyId, { ...viewRange(view, date), technicianId: tech ?? undefined });
  const laneTechnicians = [...allTechnicians];
  for (const appointment of data.appointments) {
    if (appointment.status === "cancelled") continue;
    if (!laneTechnicians.some((t) => t.id === appointment.technician.id)) laneTechnicians.push(appointment.technician);
  }
  const visibleTechnicians = tech ? laneTechnicians.filter((t) => t.id === tech) : laneTechnicians;
  const deliveryRange = view === "day" || mapa ? { from: date, to: date } : viewRange(view, date);
  const deliveryRows = await getDeliveries(
    db,
    actor.companyId,
    deliveryRange.from,
    deliveryRange.to,
    mapa ? undefined : (tech ?? undefined),
  );
  const deliveryEntries: CalendarAppointment[] = deliveryRows.flatMap((row) => {
    const entry = asDeliveryEntry(row);
    return entry ? [entry] : [];
  });
  const overlapSet = new Set(data.overlapIds);
  const filtered = data.appointments.filter((a) => matchesStatusFilter(a, estado, overlapSet));
  const entries: CalendarAppointment[] = estado
    ? filtered
    : entregas
      ? [...data.appointments, ...deliveryEntries]
      : data.appointments;
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
  let unplaced: { id: string; code: string; customerId: string; customerName: string; address: string }[] = [];

  if (mapa) {
    const mapData = tech ? await getDay(db, actor.companyId, date) : data;
    const usedServiceIds = new Set(mapData.appointments.map((a) => a.serviceId));
    mapServices = (await companyServices(db, actor.companyId)).filter((s) => s.active || usedServiceIds.has(s.id));
    mapDrafts = (await listRouteDraftsForDay(db, actor.companyId, date)).map((d) => ({
      mode: d.mode as "tech" | "service",
      groupKey: d.groupKey,
      stopIds: d.stopIds,
      createdByName: d.createdByName,
      createdAt: d.createdAt.toISOString(),
    }));

    const mapOverlap = new Set(mapData.overlapIds);
    const activeMapAppointments = mapData.appointments.filter(
      (a) => a.status !== "cancelled" && matchesStatusFilter(a, estado, mapOverlap),
    );
    const unlocated = activeMapAppointments.filter((a) => a.address.lat == null || a.address.lng == null);
    if (unlocated.length > 0) {
      const located = await locateMissingAddresses(
        db,
        unlocated.map((a) => a.address),
        brand.location,
      );
      for (const appointment of unlocated) {
        const coords = located.get(appointment.address.id);
        if (coords) appointment.address = { ...appointment.address, ...coords };
      }
    }
    const toStop = (a: (typeof activeMapAppointments)[number]) => ({
      id: a.id,
      code: a.code,
      startMin: a.startMin,
      durationMin: a.durationMin,
      customerName: `${a.customer.firstName} ${a.customer.lastName}`,
      lat: a.address.lat as number,
      lng: a.address.lng as number,
      status: a.status,
      rug: appointmentNeedsPickup(a, brand.features.rugPickup),
      deliveryLabel: hasDelivery(a)
        ? `${formatDayLabel(a.deliveryDate)} · ${formatMinutes(a.deliveryStartMin)}`
        : undefined,
      technicianId: a.technician.id,
      technicianName: a.technician.name,
      technicianColor: a.technician.color,
      serviceId: a.service.id,
      serviceName: serviceLabel(a),
      address: `${a.address.line1}${a.address.unit ? ` ${a.address.unit}` : ""}, ${a.address.city}, ${a.address.state} ${a.address.zip}`,
      notes: a.notes,
    });
    mapStops = activeMapAppointments.filter((a) => a.address.lat != null && a.address.lng != null).map(toStop);
    missingCoords = activeMapAppointments.length - mapStops.length;
    unplaced = activeMapAppointments
      .filter((a) => a.address.lat == null || a.address.lng == null)
      .map((a) => ({
        id: a.id,
        code: a.code,
        customerId: a.customer.id,
        customerName: `${a.customer.firstName} ${a.customer.lastName}`.trim(),
        address: `${a.address.line1}, ${a.address.city}, ${a.address.state} ${a.address.zip}`,
      }));

    if (entregas) {
      const unlocatedDeliveries = deliveryRows.filter(
        (a) => !a.destinationAddress && (a.address.lat == null || a.address.lng == null),
      );
      if (unlocatedDeliveries.length > 0) {
        const located = await locateMissingAddresses(
          db,
          unlocatedDeliveries.map((a) => a.address),
          brand.location,
        );
        for (const row of unlocatedDeliveries) {
          const coords = located.get(row.address.id);
          if (coords) row.address = { ...row.address, ...coords };
        }
      }
      for (const row of deliveryRows) {
        const entry = asDeliveryEntry(row);
        const place = row.destinationAddress ?? row.address;
        if (!entry || place.lat == null || place.lng == null) {
          missingCoords += 1;
          continue;
        }
        mapStops.push({
          ...toStop(entry),
          id: deliveryKey(row.id),
          kind: "delivery",
          lat: place.lat,
          lng: place.lng,
          address: `${place.line1}${place.unit ? ` ${place.unit}` : ""}, ${place.city}, ${place.state} ${place.zip}`,
        });
      }
    }
  }

  const requestedAppointment = z.uuid().safeParse(first(params.appt));
  let selected: Awaited<ReturnType<typeof getAppointment>> | null = null;
  if (requestedAppointment.success) {
    try {
      selected = await getAppointment(db, actor.companyId, requestedAppointment.data);
    } catch (error) {
      if (!(error instanceof DomainError && error.code === "not_found")) throw error;
    }
  }
  const selectedId = selected?.id ?? null;
  const photos = selected ? await panelPhotos(db, getPhotoStorage, actor, selected.id) : null;
  const selectedConflicts = selected ? await conflictingAppointments(db, actor.companyId, selected.id) : [];
  const selectedVehicles =
    selected && brand.features.vehicles ? await listVehicles(db, actor.companyId, selected.customer.id) : [];
  const panelServices = selected
    ? (await companyServices(db, actor.companyId))
        .filter((s) => s.active || selected.items.some((item) => item.serviceId === s.id))
        .map(toFormService)
    : [];

  return (
    <AppShell active="calendar" actor={actor}>
      <main
        className={`mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8 ${
          selected ? "2xl:pr-[26rem]" : ""
        }`}
      >
        <CalendarToolbar
          view={view}
          date={date}
          today={today}
          tech={tech}
          technicians={allTechnicians}
          mapa={mapa}
          entregas={entregas}
          deliveryCount={deliveryEntries.length}
          estado={estado}
          rugPickup={brand.features.rugPickup}
        />
        <CalendarSummary
          summary={summaryForDisplay}
          showConflicts={!mapa}
          activeFilter={estado}
          hrefFor={(filter) => calendarHref({ ...nav, mapa, estado: filter })}
        />
        {estado && (
          <section
            aria-label="Citas filtradas"
            className="-mt-1 flex flex-col gap-2 rounded-xl border border-brand/30 bg-brand-soft/30 px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                Mostrando solo: {STATUS_FILTERS[estado].label.toLowerCase()} ({filtered.length})
              </p>
              <Link
                href={calendarHref({ ...nav, mapa, estado: null })}
                scroll={false}
                className="rounded-full border border-hair bg-paper px-3 py-1 text-xs font-semibold hover:bg-canvas"
              >
                Quitar filtro
              </Link>
            </div>
            {filtered.length === 0 ? (
              <p className="text-sm text-soft">No hay citas con ese estado en este periodo.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {filtered.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={calendarHref({ ...nav, view: "day", date: a.date, appt: a.id })}
                      scroll={false}
                      className="flex items-center gap-2 rounded-full border border-hair bg-paper py-1 pl-1 pr-3 text-xs hover:border-brand/50 hover:bg-brand-soft/40"
                    >
                      <span
                        className="font-display flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ backgroundColor: a.technician.color, color: readableOn(a.technician.color) }}
                      >
                        {initialsOf(a.technician.name)}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {view === "day" ? "" : `${formatDayLabel(a.date)} · `}
                        {formatMinutes(a.startMin)}
                      </span>
                      <span>
                        {a.customer.firstName} {a.customer.lastName}
                      </span>
                      <span className="text-muted">{serviceLabel(a)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {mapa && (
          <>
            <MapViewLoader
              key={`${date}-${entregas ? "entregas" : "citas"}`}
              date={date}
              stops={mapStops}
              technicians={mapTechnicians}
              services={mapServices}
              drafts={mapDrafts}
              returnHref={calendarHref({ ...nav, mapa: true })}
            />
            {!entregas && deliveryRows.length > 0 && (
              <p className="-mt-1 rounded-md border border-brand/30 bg-brand-soft/50 px-4 py-2.5 text-sm text-brand-ink">
                Este día también hay {deliveryRows.length} {deliveryRows.length === 1 ? "entrega" : "entregas"}.{" "}
                <Link
                  href={calendarHref({ ...nav, mapa: true, entregas: true })}
                  className="font-semibold underline underline-offset-2"
                >
                  Activa Entregas para verlas en el mapa
                </Link>
              </p>
            )}
            {missingCoords > 0 && (
              <div className="-mt-1 flex flex-col gap-2 rounded-md border border-warning/40 bg-warning-soft/60 px-4 py-3 text-sm">
                <p className="font-semibold text-warning">
                  {missingCoords} {missingCoords === 1 ? "cita no aparece" : "citas no aparecen"} en el mapa porque su
                  dirección no se pudo ubicar.
                </p>
                {unplaced.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {unplaced.map((row) => (
                      <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                        <span className="font-display font-semibold tabular-nums">{row.code}</span>
                        <span className="font-medium">{row.customerName}</span>
                        <span className="text-soft">{row.address}</span>
                        <Link
                          href={`/customers/${row.customerId}`}
                          className="font-semibold text-brand-ink underline underline-offset-2"
                        >
                          Corregir dirección
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}

        {!mapa && view === "day" && (
          <DayGrid
            appointments={entries}
            overlapIds={data.overlapIds}
            technicians={visibleTechnicians}
            nav={nav}
            selectedId={selectedId}
            nowMin={nowMin}
            rugPickup={brand.features.rugPickup}
          />
        )}
        {!mapa && view === "day" && (
          <p className="-mt-3 text-xs text-muted">
            <span className="md:hidden">
              Mantén presionada una cita y arrástrala para moverla de hora o de técnico. Siempre se pide confirmación.
            </span>
            <span className="hidden md:inline">
              Arrastra una cita a otra hora o a otro técnico para moverla. Siempre se pide confirmación.
            </span>
          </p>
        )}
        {!mapa && view === "week" && (
          <WeekView
            nav={nav}
            today={today}
            appointments={entries}
            overlapIds={data.overlapIds}
            selectedId={selectedId}
            rugPickup={brand.features.rugPickup}
          />
        )}
        {!mapa && view === "month" && (
          <MonthView nav={nav} today={today} appointments={entries} overlapIds={data.overlapIds} />
        )}

        <CalendarLegend technicians={allTechnicians} rugPickup={brand.features.rugPickup} />
      </main>

      <CalendarNotice />

      {estado && (
        <Link
          href={calendarHref({ ...nav, mapa, estado: null })}
          scroll={false}
          className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-rail py-2 pl-4 pr-2 text-sm font-semibold text-white shadow-xl lg:bottom-6 print:hidden"
        >
          <span className="truncate">
            Viendo solo: {STATUS_FILTERS[estado].label.toLowerCase()} ({filtered.length})
          </span>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs">
            Ver todas
            <Icon name="close" size={12} />
          </span>
        </Link>
      )}

      {selected && photos && (
        <AppointmentPanel
          appointment={selected}
          technicians={allTechnicians}
          services={panelServices}
          nav={nav}
          photos={photos}
          conflicts={selectedConflicts}
          vehicles={selectedVehicles}
          rugPickup={brand.features.rugPickup}
          vehicleCare={brand.features.vehicles}
        />
      )}
    </AppShell>
  );
}
