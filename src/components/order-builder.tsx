"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { scheduleOrderAction } from "@/app/orders/new/actions";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { CustomerPicker } from "@/components/customer-picker";
import { INPUT } from "@/components/form-kit";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/modal";
import { QuickCustomerForm } from "@/components/quick-customer-form";
import { ServiceIcon } from "@/components/service-icon";
import { preparePhoto } from "@/lib/image-resize";
import { MAX_PHOTOS_PER_APPOINTMENT } from "@/domain/photo-rules";
import { TicketLineExtras, TicketPhotoStrip, swatchFor, type TicketPhoto } from "@/components/ticket-line-extras";
import {
  centsToDollars,
  cleanDetails,
  fieldsForService,
  itemKey,
  itemSpecKey,
  parseDollars,
  validateItems,
  type DetailKey,
  type ItemDetails,
  type ItemErrors,
} from "@/domain/appointment-items";
import { minutesToTimeInput, parseTimeInput } from "@/domain/appointment-panel";
import {
  DESTINATION_PREFIX,
  destinationFromValues,
  type FormService,
  type FormTechnician,
  type PickerCustomer,
} from "@/domain/appointment-form";
import { formatMinutes } from "@/domain/appointment-rules";
import { formatDayLabel } from "@/domain/calendar-view";
import { formatAddress, formatMoney } from "@/domain/invoice";
import { addDays, confirmationMessage, whatsappHref } from "@/domain/order";
import { guessServiceIcon } from "@/domain/service-icons";
import { calendarHref } from "@/lib/calendar-links";

type Line = {
  uid: number;
  serviceId: string;
  price: string;
  specs: Record<string, string>;
  details: ItemDetails;
  photos: TicketPhoto[];
  open: boolean;
};

type PhotoUpload = { total: number; done: number; failed: number };

type Visit = { date: string; startMin: number; durationMin: number; technicianId: string };

type Schedule = {
  pickup: Visit;
  delivery: Visit | null;
  readyDate: string;
  destination: ReturnType<typeof destinationFromValues> | null;
};

type Done = {
  id: string;
  code: string;
  date: string;
  conflicts: number;
  message: string;
  phone: string;
  photos: PhotoUpload | null;
};

let photoSequence = 0;

const FIELD = `${INPUT} py-2`;
const LABEL = "flex flex-col gap-1 text-xs font-medium text-soft";

function lineCents(line: Line, service: FormService | undefined): number {
  const parsed = parseDollars(line.price);
  if (parsed === null || Number.isNaN(parsed)) return parsed === null ? (service?.basePriceCents ?? 0) : 0;
  return parsed;
}

function ScheduleForm({
  technicians,
  initial,
  suggestedDuration,
  today,
  needsDestination,
  onApply,
  onCancel,
}: {
  technicians: FormTechnician[];
  initial: Schedule | null;
  suggestedDuration: number;
  today: string;
  needsDestination: boolean;
  onApply: (schedule: Schedule) => void;
  onCancel: () => void;
}) {
  const [withDelivery, setWithDelivery] = useState(initial ? initial.delivery !== null : true);
  const [error, setError] = useState<string | null>(null);
  const pickupDate = initial?.pickup.date ?? today;
  const defaultTech = initial?.pickup.technicianId ?? technicians[0]?.id ?? "";

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const pickupStart = parseTimeInput(text("pickupTime"));
    const pickup: Visit = {
      date: text("pickupDate"),
      startMin: pickupStart ?? -1,
      durationMin: Number(text("pickupDuration")),
      technicianId: text("pickupTech"),
    };
    if (!pickup.date || pickup.startMin < 0 || !pickup.technicianId) {
      setError("Completa la fecha, la hora y el técnico de la recogida.");
      return;
    }
    if (!Number.isInteger(pickup.durationMin) || pickup.durationMin < 15 || pickup.durationMin > 720) {
      setError("La duración debe estar entre 15 y 720 minutos.");
      return;
    }
    let delivery: Visit | null = null;
    if (withDelivery) {
      const deliveryStart = parseTimeInput(text("deliveryTime"));
      delivery = {
        date: text("deliveryDate"),
        startMin: deliveryStart ?? -1,
        durationMin: Number(text("deliveryDuration")),
        technicianId: text("deliveryTech"),
      };
      if (!delivery.date || delivery.startMin < 0 || !delivery.technicianId) {
        setError("Completa la fecha, la hora y el técnico de la entrega.");
        return;
      }
      if (delivery.date < pickup.date) {
        setError("La entrega no puede ser antes de la recogida.");
        return;
      }
      if (!Number.isInteger(delivery.durationMin) || delivery.durationMin < 15 || delivery.durationMin > 720) {
        setError("La duración de la entrega debe estar entre 15 y 720 minutos.");
        return;
      }
    }
    const values = Object.fromEntries([...data.entries()].map(([key, value]) => [key, String(value)]));
    const destination = needsDestination ? destinationFromValues(values) : null;
    if (destination && (!destination.line1 || !destination.city || !destination.zip)) {
      setError("Completa la dirección de entrega.");
      return;
    }
    onApply({ pickup, delivery, readyDate: text("readyDate"), destination });
  }

  const techOptions = technicians.map((technician) => (
    <option key={technician.id} value={technician.id}>
      {technician.name}
    </option>
  ));

  return (
    <form onSubmit={apply} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-5 md:grid-cols-2">
        <fieldset className="flex flex-col gap-3 rounded-md border border-hair p-4">
          <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
            <ServiceIcon icon="truck" size={18} className="text-brand-ink" /> Recogida
          </legend>
          <label className={LABEL}>
            Fecha
            <input type="date" name="pickupDate" defaultValue={pickupDate} className={FIELD} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={LABEL}>
              Hora
              <input
                type="time"
                name="pickupTime"
                defaultValue={initial ? minutesToTimeInput(initial.pickup.startMin) : "09:00"}
                className={FIELD}
              />
            </label>
            <label className={LABEL}>
              Duración (min)
              <input
                type="number"
                name="pickupDuration"
                min={15}
                max={720}
                step={15}
                defaultValue={initial?.pickup.durationMin ?? suggestedDuration}
                className={FIELD}
              />
            </label>
          </div>
          <label className={LABEL}>
            Técnico
            <select name="pickupTech" defaultValue={defaultTech} className={FIELD}>
              {techOptions}
            </select>
          </label>
          <label className={LABEL}>
            Listo en (opcional)
            <input type="date" name="readyDate" defaultValue={initial?.readyDate ?? ""} className={FIELD} />
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded-md border border-hair p-4">
          <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
            <ServiceIcon icon="house" size={18} className="text-brand-ink" /> Entrega
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={withDelivery}
              onChange={(event) => setWithDelivery(event.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            Programar la entrega ahora
          </label>
          {withDelivery ? (
            <>
              <label className={LABEL}>
                Fecha
                <input
                  type="date"
                  name="deliveryDate"
                  min={pickupDate}
                  defaultValue={initial?.delivery?.date ?? addDays(pickupDate, 1)}
                  className={FIELD}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={LABEL}>
                  Hora
                  <input
                    type="time"
                    name="deliveryTime"
                    defaultValue={initial?.delivery ? minutesToTimeInput(initial.delivery.startMin) : "09:00"}
                    className={FIELD}
                  />
                </label>
                <label className={LABEL}>
                  Duración (min)
                  <input
                    type="number"
                    name="deliveryDuration"
                    min={15}
                    max={720}
                    step={15}
                    defaultValue={initial?.delivery?.durationMin ?? 60}
                    className={FIELD}
                  />
                </label>
              </div>
              <label className={LABEL}>
                Técnico
                <select
                  name="deliveryTech"
                  defaultValue={initial?.delivery?.technicianId ?? defaultTech}
                  className={FIELD}
                >
                  {techOptions}
                </select>
              </label>
            </>
          ) : (
            <p className="text-sm text-soft">Puedes programarla después desde la cita.</p>
          )}
        </fieldset>
      </div>

      {needsDestination && (
        <fieldset className="grid gap-3 rounded-md border border-hair p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Dirección de entrega</legend>
          <label className={`${LABEL} sm:col-span-2`}>
            Calle y número
            <AddressAutocomplete
              control={{ id: "order-dest-line1", "aria-invalid": false, "aria-describedby": undefined }}
              name={`${DESTINATION_PREFIX}line1`}
              prefix={DESTINATION_PREFIX}
              defaultValue={initial?.destination?.line1 ?? ""}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            Apartamento o suite
            <input
              name={`${DESTINATION_PREFIX}unit`}
              defaultValue={initial?.destination?.unit ?? ""}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            Ciudad
            <input
              name={`${DESTINATION_PREFIX}city`}
              defaultValue={initial?.destination?.city ?? ""}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            Estado
            <input
              name={`${DESTINATION_PREFIX}state`}
              maxLength={2}
              defaultValue={initial?.destination?.state ?? "FL"}
              className={`${FIELD} uppercase`}
            />
          </label>
          <label className={LABEL}>
            Código postal
            <input name={`${DESTINATION_PREFIX}zip`} defaultValue={initial?.destination?.zip ?? ""} className={FIELD} />
          </label>
        </fieldset>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-attention-soft px-3.5 py-2.5 text-sm font-medium text-attention">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm font-semibold text-soft hover:bg-canvas"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Aplicar
        </button>
      </div>
    </form>
  );
}

export function OrderBuilder({
  services,
  technicians,
  today,
  isAdmin = false,
}: {
  services: FormService[];
  technicians: FormTechnician[];
  today: string;
  isAdmin?: boolean;
}) {
  const categories = [...new Set(services.map((service) => service.category))];
  const [filters, setFilters] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  const [customer, setCustomer] = useState<PickerCustomer | null>(null);
  const [addressId, setAddressId] = useState("");
  const [notes, setNotes] = useState("");
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [modal, setModal] = useState<"customer" | "schedule" | null>(null);
  const [itemErrors, setItemErrors] = useState<ItemErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = new Map(services.map((service) => [service.id, service]));
  const shownCategories = filters.length === 0 ? categories : categories.filter((name) => filters.includes(name));
  const photoCount = lines.reduce((sum, line) => sum + line.photos.length, 0);

  function toggleFilter(name: string | null) {
    if (name === null) return setFilters([]);
    setFilters((current) => {
      const next = current.includes(name) ? current.filter((item) => item !== name) : [...current, name];
      return next.length === categories.length ? [] : next;
    });
  }
  const totalCents = lines.reduce((sum, line) => sum + lineCents(line, byId.get(line.serviceId)), 0);
  const needsDestination = lines.some((line) => byId.get(line.serviceId)?.twoAddresses);
  const suggestedDuration = Math.min(
    720,
    Math.max(15, lines.reduce((sum, line) => sum + (byId.get(line.serviceId)?.durationMin ?? 0), 0) || 60),
  );

  function addService(service: FormService) {
    const hasRequired = fieldsForService(service).some((field) => field.required);
    setLines((current) => [
      ...current.map((line) => ({ ...line, open: false })),
      {
        uid: current.reduce((max, line) => Math.max(max, line.uid), 0) + 1,
        serviceId: service.id,
        price: centsToDollars(service.basePriceCents),
        specs: {},
        details: {},
        photos: [],
        open: hasRequired,
      },
    ]);
    setDone(null);
  }

  function updateLine(uid: number, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.uid === uid ? { ...line, ...patch } : line)));
  }

  function removeLine(uid: number) {
    lines.find((line) => line.uid === uid)?.photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setLines((current) => current.filter((line) => line.uid !== uid));
    setItemErrors({});
  }

  function setDetail(uid: number, key: DetailKey, value: string) {
    setLines((current) =>
      current.map((line) => (line.uid === uid ? { ...line, details: { ...line.details, [key]: value } } : line)),
    );
  }

  function addPhotos(uid: number, files: File[]) {
    const added = files.map((file) => {
      photoSequence += 1;
      return { key: photoSequence, file, url: URL.createObjectURL(file) };
    });
    setLines((current) =>
      current.map((line) => (line.uid === uid ? { ...line, photos: [...line.photos, ...added] } : line)),
    );
  }

  function removePhoto(uid: number, key: number) {
    setLines((current) =>
      current.map((line) => {
        if (line.uid !== uid) return line;
        line.photos.filter((photo) => photo.key === key).forEach((photo) => URL.revokeObjectURL(photo.url));
        return { ...line, photos: line.photos.filter((photo) => photo.key !== key) };
      }),
    );
  }

  async function uploadPhotos(appointmentId: string, itemIds: string[], pending: Line[]) {
    const jobs = pending.flatMap((line, index) =>
      line.photos.map((photo) => ({ photo, itemId: itemIds[index] ?? null })),
    );
    if (jobs.length === 0) return;
    let done = 0;
    let failed = 0;
    const report = () =>
      setDone((current) => (current ? { ...current, photos: { total: jobs.length, done, failed } } : current));
    report();
    for (const job of jobs) {
      try {
        const body = new FormData();
        body.set("file", await preparePhoto(job.photo.file), "foto");
        if (job.itemId) body.set("itemId", job.itemId);
        const response = await fetch(`/api/appointments/${appointmentId}/photos`, { method: "POST", body });
        if (!response.ok) throw new Error(String(response.status));
        done += 1;
      } catch {
        failed += 1;
      }
      report();
    }
  }

  function chooseCustomer(next: PickerCustomer) {
    setCustomer(next);
    setAddressId(next.addresses[0]?.id ?? "");
    setMessage(null);
  }

  function reset() {
    lines.forEach((line) => line.photos.forEach((photo) => URL.revokeObjectURL(photo.url)));
    setLines([]);
    setCustomer(null);
    setAddressId("");
    setNotes("");
    setSchedule(null);
    setItemErrors({});
    setMessage(null);
    setNotice(null);
    setDone(null);
  }

  function submit() {
    setMessage(null);
    setNotice(null);
    const { inputs, errors } = validateItems(
      lines.map((line) => ({ serviceId: line.serviceId, price: line.price, specs: line.specs })),
      (id) => byId.get(id),
    );
    setItemErrors(errors);
    if (lines.length === 0) return setMessage("Agrega al menos un servicio al ticket.");
    if (Object.keys(errors).length > 0) {
      setLines((current) =>
        current.map((line, index) => ({
          ...line,
          open: line.open || Object.keys(errors).some((key) => key.startsWith(`items.${index}.`)),
        })),
      );
      return setMessage("Revisa los datos marcados en el ticket.");
    }
    if (!customer) return setMessage("Elige o crea el cliente del pedido.");
    if (!addressId) return setMessage("Elige la dirección del cliente.");
    if (!schedule) return setMessage("Programa la recogida con el botón del camión.");

    const chosen = customer;
    const plan = schedule;
    const sent = lines;
    const payload = {
      customerId: chosen.id,
      addressId,
      technicianId: plan.pickup.technicianId,
      date: plan.pickup.date,
      startMin: plan.pickup.startMin,
      durationMin: plan.pickup.durationMin,
      items: inputs.map((input, index) => ({ ...input, details: cleanDetails(lines[index]?.details ?? {}) })),
      notes: notes.trim(),
      ...(plan.readyDate ? { readyDate: plan.readyDate } : {}),
      ...(plan.destination ? { destinationAddress: plan.destination } : {}),
      ...(plan.delivery
        ? {
            delivery: {
              date: plan.delivery.date,
              startMin: plan.delivery.startMin,
              durationMin: plan.delivery.durationMin,
              technicianId: plan.delivery.technicianId,
            },
          }
        : {}),
    };
    const summary = lines.map((line) => ({
      name: byId.get(line.serviceId)?.name ?? "Servicio",
      priceCents: lineCents(line, byId.get(line.serviceId)),
    }));

    startTransition(async () => {
      const result = await scheduleOrderAction(payload);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setDone({
        id: result.id,
        code: result.code,
        date: result.date,
        conflicts: result.conflicts,
        phone: chosen.phone,
        photos: null,
        message: confirmationMessage({
          customerName: chosen.firstName,
          code: result.code,
          pickup: plan.pickup,
          delivery: plan.delivery,
          items: summary,
          totalCents,
        }),
      });
      await uploadPhotos(result.id, result.itemIds, sent);
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_25rem]">
      <section className="flex min-w-0 flex-col gap-4">
        <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={filters.length === 0}
            onClick={() => toggleFilter(null)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              filters.length === 0
                ? "border-brand bg-brand text-white"
                : "border-hair bg-paper text-soft hover:text-ink"
            }`}
          >
            Todos
          </button>
          {categories.map((name) => {
            const on = filters.includes(name);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                onClick={() => toggleFilter(name)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                  on ? "border-brand bg-brand-soft text-brand-ink" : "border-hair bg-paper text-soft hover:text-ink"
                }`}
              >
                {name}
              </button>
            );
          })}
          {isAdmin && (
            <Link
              href="/services/new?volver=pedido"
              className="ml-auto flex items-center gap-1.5 rounded-full border border-dashed border-brand/50 px-4 py-1.5 text-sm font-semibold text-brand-ink hover:bg-brand-soft/50"
            >
              <Icon name="plus" size={14} />
              Nuevo servicio
            </Link>
          )}
        </div>

        {services.length === 0 ? (
          <p className="rounded-md border border-dashed border-hair bg-paper px-4 py-10 text-center text-sm text-muted">
            {isAdmin
              ? "Todavía no hay servicios. Crea el primero con «Nuevo servicio»."
              : "Todavía no hay servicios activos. Pídele al súper admin que los cree."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {shownCategories
              .flatMap((name) => services.filter((service) => service.category === name))
              .map((service) => {
                const count = lines.filter((line) => line.serviceId === service.id).length;
                return (
                  <div key={service.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => addService(service)}
                      className="flex aspect-square w-full flex-col items-center justify-center gap-2.5 rounded-md border border-hair bg-paper p-3 text-center shadow-[0_1px_0_rgba(18,24,31,0.04)] transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md"
                    >
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand-ink transition-colors group-hover:bg-brand group-hover:text-white">
                        <ServiceIcon icon={service.iconKey ?? guessServiceIcon(service)} size={30} />
                      </span>
                      <span className="line-clamp-2 text-sm font-medium leading-tight">{service.name}</span>
                      <span className="text-xs tabular-nums text-muted">{formatMoney(service.basePriceCents)}</span>
                    </button>
                    {count > 0 && (
                      <span className="font-display pointer-events-none absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-white">
                        {count}
                      </span>
                    )}
                    {isAdmin && (
                      <Link
                        href={`/services/${service.id}?volver=pedido`}
                        aria-label={`Editar ${service.name}`}
                        title="Editar servicio"
                        className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-paper/90 text-soft opacity-0 shadow-sm transition-opacity hover:text-ink focus:opacity-100 group-hover:opacity-100"
                      >
                        <Icon name="wrench" size={13} />
                      </Link>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-4 self-start rounded-md border border-hair bg-paper p-4 lg:sticky lg:top-4">
        {done ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 rounded-md bg-success-soft px-4 py-3 text-success">
              <span className="text-sm font-semibold">Pedido {done.code} programado</span>
              {done.conflicts > 0 && (
                <span className="text-xs text-warning">
                  Tiene conflicto con {done.conflicts} {done.conflicts === 1 ? "cita" : "citas"} del técnico.
                </span>
              )}
              {done.photos && (
                <span className={`text-xs ${done.photos.failed > 0 ? "text-attention" : "text-success"}`}>
                  {done.photos.done + done.photos.failed < done.photos.total
                    ? `Subiendo fotos ${done.photos.done + done.photos.failed + 1} de ${done.photos.total}…`
                    : done.photos.failed > 0
                      ? `${done.photos.failed} ${done.photos.failed === 1 ? "foto no se pudo subir" : "fotos no se pudieron subir"}; agrégalas desde la cita.`
                      : `${done.photos.total} ${done.photos.total === 1 ? "foto guardada" : "fotos guardadas"} en la cita.`}
                </span>
              )}
            </div>
            <label className={LABEL}>
              Mensaje para el cliente
              <textarea readOnly value={done.message} rows={10} className={`${FIELD} resize-y text-sm`} />
            </label>
            <a
              href={whatsappHref(done.phone, done.message)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Enviar confirmación por WhatsApp
            </a>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={calendarHref({ view: "day", date: done.date, appt: done.id, entregas: true })}
                className="rounded-md border border-hair px-3 py-2 text-center text-sm font-semibold hover:bg-canvas"
              >
                Ver en el calendario
              </Link>
              <button
                type="button"
                onClick={reset}
                className="rounded-md border border-hair px-3 py-2 text-sm font-semibold hover:bg-canvas"
              >
                Nuevo pedido
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Cliente</span>
                {!customer && (
                  <button
                    type="button"
                    onClick={() => setModal("customer")}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-white hover:opacity-90"
                    aria-label="Crear cliente nuevo"
                    title="Crear cliente nuevo"
                  >
                    <Icon name="plus" />
                  </button>
                )}
              </div>
              <CustomerPicker
                selected={customer}
                onSelect={chooseCustomer}
                onClear={() => {
                  setCustomer(null);
                  setAddressId("");
                }}
                onCreateNew={() => setModal("customer")}
              />
              {customer && customer.addresses.length > 1 && (
                <div role="radiogroup" aria-label="Dirección del servicio" className="flex flex-col gap-1.5">
                  {customer.addresses.map((address) => (
                    <label
                      key={address.id}
                      className="flex cursor-pointer items-start gap-2 rounded-md border border-hair px-3 py-2 text-xs has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40"
                    >
                      <input
                        type="radio"
                        name="order-address"
                        checked={addressId === address.id}
                        onChange={() => setAddressId(address.id)}
                        className="mt-0.5 accent-brand"
                      />
                      {formatAddress(address)}
                    </label>
                  ))}
                </div>
              )}
              {customer && customer.addresses.length === 1 && (
                <p className="text-xs text-soft">{formatAddress(customer.addresses[0])}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">
                Ticket <span className="font-normal text-muted">({lines.length})</span>
              </span>
              {lines.length === 0 ? (
                <p className="rounded-md border border-dashed border-hair px-3 py-6 text-center text-sm text-muted">
                  Toca un servicio para agregarlo.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lines.map((line, index) => {
                    const service = byId.get(line.serviceId);
                    if (!service) return null;
                    const fields = fieldsForService(service);
                    const priceKey = itemKey(index, "price");
                    const lineHasError = Object.keys(itemErrors).some((key) => key.startsWith(`items.${index}.`));
                    return (
                      <li
                        key={line.uid}
                        className={`rounded-md border ${lineHasError ? "border-attention" : "border-hair"} bg-canvas/40`}
                      >
                        <div className="flex items-center gap-2 px-2.5 py-2">
                          <button
                            type="button"
                            onClick={() => updateLine(line.uid, { open: !line.open })}
                            aria-expanded={line.open}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <ServiceIcon
                              icon={service.iconKey ?? guessServiceIcon(service)}
                              size={20}
                              className="shrink-0 text-brand-ink"
                            />
                            <span className="truncate text-sm font-medium">{service.name}</span>
                            <Icon
                              name="down"
                              size={14}
                              className={`shrink-0 text-muted transition-transform ${line.open ? "rotate-180" : ""}`}
                            />
                          </button>
                          <span className="relative w-24 shrink-0">
                            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">
                              $
                            </span>
                            <input
                              aria-label={`Precio de ${service.name}`}
                              inputMode="decimal"
                              value={line.price}
                              onChange={(event) => updateLine(line.uid, { price: event.target.value })}
                              aria-invalid={Boolean(itemErrors[priceKey])}
                              className="w-full rounded-md border border-hair bg-paper py-1.5 pl-5 pr-2 text-right text-sm tabular-nums focus:border-brand focus:outline-none aria-[invalid=true]:border-attention"
                            />
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLine(line.uid)}
                            aria-label={`Quitar ${service.name}`}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-attention-soft hover:text-attention"
                          >
                            <Icon name="close" size={14} />
                          </button>
                        </div>
                        {!line.open && (line.photos.length > 0 || Object.values(line.details).some(Boolean)) && (
                          <div className="flex flex-col gap-1.5 px-2.5 pb-2">
                            <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-soft">
                              {line.details.color && (
                                <span className="flex items-center gap-1 rounded-full bg-paper px-2 py-0.5">
                                  {swatchFor(line.details.color) && (
                                    <span
                                      className="h-2.5 w-2.5 rounded-full border border-ink/20"
                                      style={{ backgroundColor: swatchFor(line.details.color) ?? undefined }}
                                    />
                                  )}
                                  {line.details.color}
                                </span>
                              )}
                              {line.details.size && (
                                <span className="rounded-full bg-paper px-2 py-0.5">{line.details.size}</span>
                              )}
                              {line.details.dimensions && (
                                <span className="rounded-full bg-paper px-2 py-0.5">{line.details.dimensions}</span>
                              )}
                              {line.details.notes && (
                                <span className="max-w-full truncate rounded-full bg-paper px-2 py-0.5">
                                  {line.details.notes}
                                </span>
                              )}
                            </span>
                            <TicketPhotoStrip photos={line.photos} />
                          </div>
                        )}
                        {line.open && (
                          <div className="flex flex-col gap-3 border-t border-hair px-2.5 py-2.5">
                            {fields.length > 0 && (
                              <div className="grid grid-cols-2 gap-2">
                                {fields.map((field) => {
                                  const key = itemSpecKey(index, field.key);
                                  const value = line.specs[field.key] ?? "";
                                  const set = (next: string) =>
                                    updateLine(line.uid, { specs: { ...line.specs, [field.key]: next } });
                                  return (
                                    <label key={field.key} className={LABEL}>
                                      <span>
                                        {field.label}
                                        {field.required && <span className="text-attention"> *</span>}
                                      </span>
                                      {field.type === "select" ? (
                                        <select
                                          value={value}
                                          onChange={(event) => set(event.target.value)}
                                          aria-invalid={Boolean(itemErrors[key])}
                                          className={FIELD}
                                        >
                                          <option value="">Elige</option>
                                          {(field.options ?? []).map((option) => (
                                            <option key={option} value={option}>
                                              {option}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <input
                                          type="number"
                                          inputMode="decimal"
                                          min={0}
                                          step="any"
                                          value={value}
                                          onChange={(event) => set(event.target.value)}
                                          aria-invalid={Boolean(itemErrors[key])}
                                          className={FIELD}
                                        />
                                      )}
                                      {itemErrors[key] && <span className="text-attention">{itemErrors[key]}</span>}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                            <TicketLineExtras
                              details={line.details}
                              photos={line.photos}
                              photoRoom={MAX_PHOTOS_PER_APPOINTMENT - photoCount}
                              onDetail={(key, value) => setDetail(line.uid, key, value)}
                              onAddPhotos={(files) => addPhotos(line.uid, files)}
                              onRemovePhoto={(key) => removePhoto(line.uid, key)}
                            />
                          </div>
                        )}
                        {itemErrors[priceKey] && (
                          <p className="px-2.5 pb-2 text-xs text-attention">{itemErrors[priceKey]}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <label className={LABEL}>
              Notas
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                placeholder="Indicaciones para el técnico…"
                className={`${FIELD} resize-y`}
              />
            </label>

            <button
              type="button"
              onClick={() => setModal("schedule")}
              className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                schedule ? "border-brand/50 bg-brand-soft/40" : "border-dashed border-hair hover:bg-canvas"
              }`}
            >
              <ServiceIcon icon="truck" size={22} className="shrink-0 text-brand-ink" />
              {schedule ? (
                <span className="min-w-0 leading-tight">
                  <span className="block font-medium">
                    Recogida: {formatDayLabel(schedule.pickup.date)}, {formatMinutes(schedule.pickup.startMin)}
                  </span>
                  <span className="block text-xs text-soft">
                    {schedule.delivery
                      ? `Entrega: ${formatDayLabel(schedule.delivery.date)}, ${formatMinutes(schedule.delivery.startMin)}`
                      : "Entrega sin programar"}
                  </span>
                </span>
              ) : (
                <span className="font-medium text-soft">Programar recogida y entrega</span>
              )}
            </button>

            {message && (
              <p role="alert" className="rounded-md bg-attention-soft px-3 py-2 text-sm font-medium text-attention">
                {message}
              </p>
            )}
            {notice && <p className="text-sm text-soft">{notice}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="flex items-center justify-between gap-3 rounded-md bg-success px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <span>
                {pending
                  ? "Programando…"
                  : schedule
                    ? `Programar ${formatDayLabel(schedule.pickup.date)}`
                    : "Programar pedido"}
              </span>
              <span className="font-display text-base tabular-nums">{formatMoney(totalCents)}</span>
            </button>
          </>
        )}
      </aside>

      {modal === "customer" && (
        <Modal title="Nuevo cliente" onClose={() => setModal(null)} wide>
          <QuickCustomerForm
            onCancel={() => setModal(null)}
            onCreated={(created, existing) => {
              chooseCustomer(created);
              setNotice(
                existing ? `${created.firstName} ya estaba registrado (${created.code}); se usó su ficha.` : null,
              );
              setModal(null);
            }}
          />
        </Modal>
      )}
      {modal === "schedule" && (
        <Modal title="Recogida y entrega" onClose={() => setModal(null)} wide>
          <ScheduleForm
            technicians={technicians}
            initial={schedule}
            suggestedDuration={suggestedDuration}
            today={today}
            needsDestination={needsDestination}
            onCancel={() => setModal(null)}
            onApply={(next) => {
              setSchedule(next);
              setMessage(null);
              setModal(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
