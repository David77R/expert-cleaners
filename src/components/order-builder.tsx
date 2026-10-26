"use client";

import { DateInput } from "@/components/date-jump";
import { useBrand } from "@/components/brand-provider";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { scheduleOrderAction } from "@/app/orders/new/actions";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { CustomerPicker } from "@/components/customer-picker";
import { INPUT } from "@/components/form-kit";
import { DeleteServiceButton } from "@/components/delete-service-button";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/modal";
import { TimeInput } from "@/components/time-input";
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
  splitTotal,
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
  type PickerAddress,
  type PickerCustomer,
} from "@/domain/appointment-form";
import { formatMinutes } from "@/domain/appointment-rules";
import { prefillFromSearch } from "@/domain/customer-form";
import { needsPickup } from "@/domain/pickup";
import { formatDayLabel } from "@/domain/calendar-view";
import { formatAddress, formatMoney } from "@/domain/invoice";
import { addDays, confirmationMessage, whatsappHref } from "@/domain/order";
import { guessServiceIcon } from "@/domain/service-icons";
import { calendarHref } from "@/lib/calendar-links";
import { VehicleSelect, fetchVehicles, type PickerVehicle } from "@/components/vehicle-select";
import { isVehicleSize, priceForSize } from "@/domain/vehicles";

type Line = {
  uid: number;
  serviceId: string;
  vehicleId: string | null;
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
  destinationChoice: string;
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
  pickupMode,
  customerAddresses,
  pickupAddressId,
  onApply,
  onCancel,
}: {
  technicians: FormTechnician[];
  initial: Schedule | null;
  suggestedDuration: number;
  today: string;
  needsDestination: boolean;
  pickupMode: boolean;
  customerAddresses: readonly PickerAddress[];
  pickupAddressId: string;
  onApply: (schedule: Schedule) => void;
  onCancel: () => void;
}) {
  const brand = useBrand();
  const [wantsDelivery, setWithDelivery] = useState(initial ? initial.delivery !== null : true);
  const withDelivery = pickupMode && wantsDelivery;
  const visitWord = pickupMode ? "de la recogida" : "de la cita";
  const [destChoice, setDestChoice] = useState(initial?.destinationChoice ?? "same");
  const pickupAddress = customerAddresses.find((address) => address.id === pickupAddressId);
  const otherAddresses = customerAddresses.filter((address) => address.id !== pickupAddressId);
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
      setError(`Completa la fecha, la hora y el técnico ${visitWord}.`);
      return;
    }
    if (!Number.isInteger(pickup.durationMin) || pickup.durationMin < 0 || pickup.durationMin > 720) {
      setError("La duración debe estar entre 0 y 720 minutos.");
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
      if (!Number.isInteger(delivery.durationMin) || delivery.durationMin < 0 || delivery.durationMin > 720) {
        setError("La duración de la entrega debe estar entre 0 y 720 minutos.");
        return;
      }
    }
    const values = Object.fromEntries([...data.entries()].map(([key, value]) => [key, String(value)]));
    const custom = needsDestination && destChoice === "custom";
    const destination = custom ? destinationFromValues(values, brand.location.state) : null;
    if (destination && (!destination.line1 || !destination.city || !destination.zip)) {
      setError("Completa la dirección de entrega.");
      return;
    }
    onApply({
      pickup,
      delivery,
      readyDate: pickupMode ? text("readyDate") : "",
      destination,
      destinationChoice: needsDestination ? destChoice : "same",
    });
  }

  const techOptions = technicians.map((technician) => (
    <option key={technician.id} value={technician.id}>
      {technician.name}
    </option>
  ));

  return (
    <form onSubmit={apply} className="flex flex-col gap-5" noValidate>
      <div className={`grid gap-5 ${pickupMode ? "md:grid-cols-2" : ""}`}>
        <fieldset className="flex flex-col gap-3 rounded-md border border-hair p-4">
          <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
            {pickupMode ? (
              <>
                <ServiceIcon icon="truck" size={18} className="text-brand-ink" /> Recogida
              </>
            ) : (
              <>
                <Icon name="calendar" size={16} className="text-brand-ink" /> Cita
              </>
            )}
          </legend>
          <label className={LABEL}>
            Fecha
            <DateInput name="pickupDate" defaultValue={pickupDate} className={FIELD} />
          </label>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">
            <label className={LABEL}>
              Hora
              <TimeInput
                name="pickupTime"
                aria-label="Hora de recogida"
                defaultValue={initial ? minutesToTimeInput(initial.pickup.startMin) : "09:00"}
                className={FIELD}
              />
            </label>
            <label className={LABEL}>
              Duración (min)
              <input
                type="number"
                name="pickupDuration"
                min={0}
                max={720}
                step={1}
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
          {pickupMode && (
            <label className={LABEL}>
              Listo en (opcional)
              <DateInput name="readyDate" clearable defaultValue={initial?.readyDate ?? ""} className={FIELD} />
            </label>
          )}
        </fieldset>

        {pickupMode && (
          <fieldset className="flex flex-col gap-3 rounded-md border border-hair p-4">
            <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
              <ServiceIcon icon="house" size={18} className="text-brand-ink" /> Entrega
            </legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={wantsDelivery}
                onChange={(event) => setWithDelivery(event.target.checked)}
                className="h-4 w-4 accent-brand"
              />
              Programar la entrega ahora
            </label>
            {withDelivery ? (
              <>
                <label className={LABEL}>
                  Fecha
                  <DateInput
                    name="deliveryDate"
                    min={pickupDate}
                    defaultValue={initial?.delivery?.date ?? addDays(pickupDate, 1)}
                    className={FIELD}
                  />
                </label>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">
                  <label className={LABEL}>
                    Hora
                    <TimeInput
                      name="deliveryTime"
                      aria-label="Hora de entrega"
                      defaultValue={initial?.delivery ? minutesToTimeInput(initial.delivery.startMin) : "09:00"}
                      className={FIELD}
                    />
                  </label>
                  <label className={LABEL}>
                    Duración (min)
                    <input
                      type="number"
                      name="deliveryDuration"
                      min={0}
                      max={720}
                      step={1}
                      defaultValue={initial?.delivery?.durationMin ?? 0}
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
        )}
      </div>

      {needsDestination && (
        <fieldset className="grid gap-3 rounded-md border border-hair p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Dirección de entrega</legend>
          <div role="radiogroup" aria-label="Dirección de entrega" className="flex flex-col gap-2 sm:col-span-2">
            {[
              {
                value: "same",
                title: "La misma de la recogida",
                detail: pickupAddress
                  ? formatAddress(pickupAddress)
                  : "La dirección del cliente que elijas en el ticket",
              },
              ...otherAddresses.map((address) => ({
                value: address.id,
                title: "Otra dirección del cliente",
                detail: formatAddress(address),
              })),
              { value: "custom", title: "Una dirección nueva", detail: "Escríbela abajo" },
            ].map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                  destChoice === option.value ? "border-brand bg-brand-soft/40" : "border-hair hover:bg-canvas"
                }`}
              >
                <input
                  type="radio"
                  name="destinationChoice"
                  value={option.value}
                  checked={destChoice === option.value}
                  onChange={() => setDestChoice(option.value)}
                  className="mt-0.5 accent-brand"
                />
                <span className="min-w-0 leading-tight">
                  <span className="block font-medium">{option.title}</span>
                  <span className="block text-xs text-soft">{option.detail}</span>
                </span>
              </label>
            ))}
          </div>
          {destChoice === "custom" && (
            <>
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
                  defaultValue={initial?.destination?.state ?? brand.location.state}
                  className={`${FIELD} uppercase`}
                />
              </label>
              <label className={LABEL}>
                Código postal
                <input
                  name={`${DESTINATION_PREFIX}zip`}
                  defaultValue={initial?.destination?.zip ?? ""}
                  className={FIELD}
                />
              </label>
            </>
          )}
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
  const brand = useBrand();
  const categories = [...new Set(services.map((service) => service.category))];
  const [filters, setFilters] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  const [customer, setCustomer] = useState<PickerCustomer | null>(null);
  const [vehicles, setVehicles] = useState<PickerVehicle[]>([]);
  const [addressId, setAddressId] = useState("");
  const [notes, setNotes] = useState("");
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [modal, setModal] = useState<"customer" | "schedule" | null>(null);
  const [customerSeed, setCustomerSeed] = useState("");
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [totalDrafts, setTotalDrafts] = useState<Record<string, string>>({});
  const [itemErrors, setItemErrors] = useState<ItemErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, startTransition] = useTransition();
  const ticketRef = useRef<HTMLElement>(null);
  const [ticketInView, setTicketInView] = useState(false);

  useEffect(() => {
    const node = ticketRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setTicketInView(entry.isIntersecting), {
      rootMargin: "0px 0px -35% 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const byId = new Map(services.map((service) => [service.id, service]));
  const shownCategories = filters.length === 0 ? categories : categories.filter((name) => filters.includes(name));
  const photoCount = lines.reduce((sum, line) => sum + line.photos.length, 0);
  const groups = [...new Set(lines.map((line) => line.serviceId))].map((serviceId) => ({
    serviceId,
    units: lines.flatMap((line, index) => (line.serviceId === serviceId ? [{ line, index }] : [])),
  }));

  function toggleFilter(name: string | null) {
    if (name === null) return setFilters([]);
    setFilters((current) => {
      const next = current.includes(name) ? current.filter((item) => item !== name) : [...current, name];
      return next.length === categories.length ? [] : next;
    });
  }
  const totalCents = lines.reduce((sum, line) => sum + lineCents(line, byId.get(line.serviceId)), 0);
  const needsDestination = lines.some((line) => byId.get(line.serviceId)?.twoAddresses);
  const pickupOrder = needsPickup(
    lines.map((line) => byId.get(line.serviceId)),
    brand.features.rugPickup,
  );
  const suggestedDuration = Math.min(
    720,
    Math.max(
      0,
      lines.reduce((sum, line) => sum + (byId.get(line.serviceId)?.durationMin ?? 0), 0),
    ),
  );

  function addService(service: FormService) {
    const hasRequired = fieldsForService(service).some((field) => field.required);
    setLines((current) => {
      const last = current.map((line) => line.serviceId).lastIndexOf(service.id);
      const vehicleId = last >= 0 ? current[last].vehicleId : vehicles.length === 1 ? vehicles[0].id : null;
      const vehicle = vehicles.find((item) => item.id === vehicleId);
      const line: Line = {
        uid: current.reduce((max, item) => Math.max(max, item.uid), 0) + 1,
        serviceId: service.id,
        vehicleId,
        price: last >= 0 ? current[last].price : centsToDollars(priceForSize(service, vehicle?.size)),
        specs: last >= 0 ? { ...current[last].specs } : {},
        details: {},
        photos: [],
        open: hasRequired && last < 0,
      };
      const closed = current.map((item) => ({ ...item, open: false }));
      return last < 0 ? [...closed, line] : [...closed.slice(0, last + 1), line, ...closed.slice(last + 1)];
    });
    setDone(null);
  }

  function renderUnit(line: Line, index: number, expanded: boolean) {
    const service = byId.get(line.serviceId);
    if (!service) return null;
    const fields = fieldsForService(service);
    const priceKey = itemKey(index, "price");
    return (
      <>
        {brand.features.vehicles && (
          <div className="px-2.5 pb-2">
            <VehicleSelect
              customerId={customer?.id ?? null}
              vehicles={vehicles}
              value={line.vehicleId}
              onChange={(vehicleId) => setLineVehicle(line.uid, vehicleId)}
              onCreated={(vehicle) => {
                const next = [...vehicles, vehicle];
                setVehicles(next);
                setLineVehicle(line.uid, vehicle.id, next);
              }}
            />
          </div>
        )}
        {!expanded && (line.photos.length > 0 || Object.values(line.details).some(Boolean)) && (
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
              {line.details.size && <span className="rounded-full bg-paper px-2 py-0.5">{line.details.size}</span>}
              {line.details.dimensions && (
                <span className="rounded-full bg-paper px-2 py-0.5">{line.details.dimensions}</span>
              )}
              {line.details.notes && (
                <span className="max-w-full truncate rounded-full bg-paper px-2 py-0.5">{line.details.notes}</span>
              )}
            </span>
            <TicketPhotoStrip photos={line.photos} />
          </div>
        )}
        {expanded && (
          <div className="flex flex-col gap-3 border-t border-hair px-2.5 py-2.5">
            {fields.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {fields.map((field) => {
                  const key = itemSpecKey(index, field.key);
                  const value = line.specs[field.key] ?? "";
                  const set = (next: string) => updateLine(line.uid, { specs: { ...line.specs, [field.key]: next } });
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
              fabricDetails={!brand.features.vehicles}
              details={line.details}
              photos={line.photos}
              photoRoom={MAX_PHOTOS_PER_APPOINTMENT - photoCount}
              onDetail={(key, value) => setDetail(line.uid, key, value)}
              onAddPhotos={(files) => addPhotos(line.uid, files)}
              onRemovePhoto={(key) => removePhoto(line.uid, key)}
            />
          </div>
        )}
        {itemErrors[priceKey] && <p className="px-2.5 pb-2 text-xs text-attention">{itemErrors[priceKey]}</p>}
      </>
    );
  }

  function toggleGroup(serviceId: string) {
    setOpenGroups((current) =>
      current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId],
    );
  }

  function setGroupTotal(serviceId: string, raw: string) {
    setTotalDrafts((current) => ({ ...current, [serviceId]: raw }));
    const cents = parseDollars(raw);
    if (cents === null || Number.isNaN(cents)) return;
    setLines((current) => {
      const prices = splitTotal(cents, current.filter((line) => line.serviceId === serviceId).length);
      let position = 0;
      return current.map((line) => {
        if (line.serviceId !== serviceId) return line;
        const price = centsToDollars(prices[position] ?? 0);
        position += 1;
        return { ...line, price };
      });
    });
  }

  function setGroupPrice(serviceId: string, price: string) {
    setLines((current) => current.map((line) => (line.serviceId === serviceId ? { ...line, price } : line)));
  }

  function removeGroup(serviceId: string) {
    lines
      .filter((line) => line.serviceId === serviceId)
      .forEach((line) => line.photos.forEach((photo) => URL.revokeObjectURL(photo.url)));
    setLines((current) => current.filter((line) => line.serviceId !== serviceId));
    setItemErrors({});
  }

  function copyFirstToAll(serviceId: string) {
    setLines((current) => {
      const first = current.find((line) => line.serviceId === serviceId);
      if (!first) return current;
      return current.map((line) =>
        line.serviceId === serviceId && line.uid !== first.uid
          ? { ...line, price: first.price, specs: { ...first.specs }, details: { ...first.details } }
          : line,
      );
    });
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
    setVehicles([]);
    setLines((current) => current.map((line) => ({ ...line, vehicleId: null })));
    if (brand.features.vehicles) {
      void fetchVehicles(next.id).then((found) => {
        setVehicles(found);
        if (found.length === 1) assignVehicleToAll(found[0]);
      });
    }
  }

  function clearCustomer() {
    setCustomer(null);
    setAddressId("");
    setVehicles([]);
    setLines((current) => current.map((line) => ({ ...line, vehicleId: null })));
  }

  function priceFor(serviceId: string, vehicle: PickerVehicle | undefined, fallback: string): string {
    const service = byId.get(serviceId);
    if (!service || !vehicle || !isVehicleSize(vehicle.size) || service.sizePrices?.[vehicle.size] === undefined) {
      return fallback;
    }
    return centsToDollars(priceForSize(service, vehicle.size));
  }

  function assignVehicleToAll(vehicle: PickerVehicle) {
    setLines((current) =>
      current.map((line) =>
        line.vehicleId
          ? line
          : { ...line, vehicleId: vehicle.id, price: priceFor(line.serviceId, vehicle, line.price) },
      ),
    );
  }

  function setLineVehicle(uid: number, vehicleId: string | null, known: readonly PickerVehicle[] = vehicles) {
    const vehicle = known.find((item) => item.id === vehicleId);
    setLines((current) =>
      current.map((line) =>
        line.uid === uid ? { ...line, vehicleId, price: priceFor(line.serviceId, vehicle, line.price) } : line,
      ),
    );
  }

  function reset() {
    lines.forEach((line) => line.photos.forEach((photo) => URL.revokeObjectURL(photo.url)));
    setLines([]);
    setCustomer(null);
    setVehicles([]);
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
    if (!schedule) {
      return setMessage(
        pickupOrder ? "Programa la recogida con el botón del camión." : "Programa la fecha y hora de la cita.",
      );
    }

    const chosen = customer;
    const basePlan = pickupOrder ? schedule : { ...schedule, delivery: null, readyDate: "" };
    let resolvedDestination = needsDestination ? basePlan.destination : null;
    if (needsDestination && basePlan.destinationChoice !== "custom") {
      const chosenId = basePlan.destinationChoice === "same" ? addressId : basePlan.destinationChoice;
      const source = customer.addresses.find((address) => address.id === chosenId);
      if (!source) return setMessage("Elige la dirección de entrega en el botón del camión.");
      resolvedDestination = {
        line1: source.line1,
        unit: source.unit,
        city: source.city,
        state: source.state,
        zip: source.zip,
      };
    }
    if (needsDestination && !resolvedDestination) return setMessage("Completa la dirección de entrega.");
    const plan = { ...basePlan, destination: resolvedDestination };
    const sent = lines;
    const payload = {
      customerId: chosen.id,
      addressId,
      technicianId: plan.pickup.technicianId,
      date: plan.pickup.date,
      startMin: plan.pickup.startMin,
      durationMin: plan.pickup.durationMin,
      items: inputs.map((input, index) => ({
        ...input,
        details: cleanDetails(lines[index]?.details ?? {}),
        vehicleId: lines[index]?.vehicleId ?? null,
      })),
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
          companyName: brand.shortName,
          customerName: chosen.firstName,
          code: result.code,
          pickup: plan.pickup,
          delivery: plan.delivery,
          kind: pickupOrder ? "pickup" : "visit",
          items: summary,
          totalCents,
        }),
      });
      await uploadPhotos(result.id, result.itemIds, sent);
    });
  }

  return (
    <div
      className={`grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_25rem] ${!done && lines.length > 0 ? "pb-16 lg:pb-0" : ""}`}
    >
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
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-4 xl:grid-cols-6">
            {shownCategories
              .flatMap((name) => services.filter((service) => service.category === name))
              .map((service) => {
                const count = lines.filter((line) => line.serviceId === service.id).length;
                return (
                  <div key={service.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => addService(service)}
                      className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-md border border-hair bg-paper p-2 text-center shadow-[0_1px_0_rgba(18,24,31,0.04)] transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md active:scale-[0.97] sm:gap-2.5 sm:p-3"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-ink transition-colors group-hover:bg-brand group-hover:text-white sm:h-14 sm:w-14">
                        <ServiceIcon icon={service.iconKey ?? guessServiceIcon(service)} size={26} />
                      </span>
                      <span className="line-clamp-2 text-xs font-medium leading-tight sm:text-sm">{service.name}</span>
                      <span className="text-xs tabular-nums text-muted">{formatMoney(service.basePriceCents)}</span>
                    </button>
                    {count > 0 && (
                      <span className="font-display pointer-events-none absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-white">
                        {count}
                      </span>
                    )}
                    {isAdmin && (
                      <div className="absolute left-2 top-2 hidden gap-1 transition-opacity focus-within:opacity-100 group-hover:opacity-100 sm:flex lg:opacity-0">
                        <Link
                          href={`/services/${service.id}?volver=pedido`}
                          aria-label={`Editar ${service.name}`}
                          title="Editar servicio"
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-paper/90 text-soft shadow-sm hover:text-ink"
                        >
                          <Icon name="wrench" size={13} />
                        </Link>
                        <DeleteServiceButton serviceId={service.id} serviceName={service.name} variant="icon" />
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {!done && lines.length > 0 && !ticketInView && (
        <a
          href="#ticket"
          className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 rounded-full bg-rail px-5 py-3 text-sm font-semibold text-white shadow-xl lg:hidden"
        >
          <span className="flex items-center gap-2">
            <span className="font-display flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1.5 text-xs tabular-nums">
              {lines.length}
            </span>
            Ver ticket
          </span>
          <span className="font-display tabular-nums">{formatMoney(totalCents)}</span>
        </a>
      )}

      <aside
        ref={ticketRef}
        id="ticket"
        className="flex min-w-0 scroll-mt-20 flex-col gap-4 self-start rounded-md border border-hair bg-paper p-4 lg:sticky lg:top-20"
      >
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
                    onClick={() => {
                      setCustomerSeed("");
                      setModal("customer");
                    }}
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
                onClear={clearCustomer}
                onCreateNew={(term) => {
                  setCustomerSeed(term);
                  setModal("customer");
                }}
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
                  {groups.map(({ serviceId, units }) => {
                    const service = byId.get(serviceId);
                    if (!service) return null;
                    const count = units.length;
                    const prices = [...new Set(units.map(({ line }) => line.price))];
                    const subtotal = units.reduce((sum, { line }) => sum + lineCents(line, service), 0);
                    const groupHasError = units.some(({ index }) =>
                      Object.keys(itemErrors).some((key) => key.startsWith(`items.${index}.`)),
                    );
                    const groupOpen =
                      groupHasError || (count === 1 ? units[0].line.open : openGroups.includes(serviceId));
                    return (
                      <li
                        key={serviceId}
                        className={`rounded-md border ${groupHasError ? "border-attention" : "border-hair"} bg-canvas/40`}
                      >
                        <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 sm:flex-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              count === 1
                                ? updateLine(units[0].line.uid, { open: !units[0].line.open })
                                : toggleGroup(serviceId)
                            }
                            aria-expanded={groupOpen}
                            className="flex min-w-0 flex-1 basis-full items-center gap-2 text-left sm:basis-0"
                          >
                            <ServiceIcon
                              icon={service.iconKey ?? guessServiceIcon(service)}
                              size={20}
                              className="shrink-0 text-brand-ink"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">
                                {service.name}
                                {count > 1 && <span className="font-display ml-1.5 text-brand-ink">x{count}</span>}
                              </span>
                              {count > 1 && (
                                <span className="block text-[11px] tabular-nums text-soft">
                                  {prices.length === 1
                                    ? `${formatMoney(lineCents(units[0].line, service))} c/u`
                                    : `≈ ${formatMoney(Math.round(subtotal / count))} c/u`}
                                </span>
                              )}
                            </span>
                            <Icon
                              name="down"
                              size={14}
                              className={`shrink-0 text-muted transition-transform ${groupOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                          <span className="ml-auto flex shrink-0 items-center rounded-md border border-hair bg-paper sm:ml-0">
                            <button
                              type="button"
                              onClick={() => removeLine(units[units.length - 1].line.uid)}
                              aria-label={`Quitar un ${service.name}`}
                              className="flex h-8 w-8 items-center justify-center text-soft hover:text-ink sm:h-7 sm:w-6"
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-xs font-semibold tabular-nums">{count}</span>
                            <button
                              type="button"
                              onClick={() => addService(service)}
                              aria-label={`Agregar otro ${service.name}`}
                              className="flex h-8 w-8 items-center justify-center text-soft hover:text-ink sm:h-7 sm:w-6"
                            >
                              +
                            </button>
                          </span>
                          <span className={`relative shrink-0 ${count > 1 ? "w-24" : "w-20"}`}>
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted">
                              $
                            </span>
                            <input
                              aria-label={count > 1 ? `Precio de cada ${service.name}` : `Precio de ${service.name}`}
                              title={count > 1 ? "Precio de cada uno" : undefined}
                              inputMode="decimal"
                              value={prices.length === 1 ? prices[0] : ""}
                              placeholder={prices.length === 1 ? undefined : "varios"}
                              onChange={(event) => setGroupPrice(serviceId, event.target.value)}
                              aria-invalid={units.some(({ index }) => Boolean(itemErrors[itemKey(index, "price")]))}
                              className={`w-full rounded-md border border-hair bg-paper py-1.5 pl-4 text-right text-sm tabular-nums focus:border-brand focus:outline-none aria-[invalid=true]:border-attention ${
                                count > 1 ? "pr-7" : "pr-1.5"
                              }`}
                            />
                            {count > 1 && (
                              <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted">
                                c/u
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeGroup(serviceId)}
                            aria-label={count > 1 ? `Quitar todos los ${service.name}` : `Quitar ${service.name}`}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-attention-soft hover:text-attention"
                          >
                            <Icon name="close" size={14} />
                          </button>
                        </div>
                        {count > 1 && (
                          <div className="flex items-center justify-end gap-2 px-2.5 pb-2">
                            <span className="text-[11px] font-medium text-soft">Total de los {count}</span>
                            <span className="relative w-28 shrink-0">
                              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted">
                                $
                              </span>
                              <input
                                aria-label={`Total de los ${count} ${service.name}`}
                                inputMode="decimal"
                                value={totalDrafts[serviceId] ?? centsToDollars(subtotal)}
                                onChange={(event) => setGroupTotal(serviceId, event.target.value)}
                                onBlur={() =>
                                  setTotalDrafts((current) => {
                                    const next = { ...current };
                                    delete next[serviceId];
                                    return next;
                                  })
                                }
                                className="w-full rounded-md border border-brand/40 bg-brand-soft/30 py-1 pl-4 pr-2 text-right text-sm font-semibold tabular-nums focus:border-brand focus:outline-none"
                              />
                            </span>
                            <span className="w-7 shrink-0" />
                          </div>
                        )}
                        {groupOpen && count === 1 && renderUnit(units[0].line, units[0].index, true)}
                        {!groupOpen && count === 1 && renderUnit(units[0].line, units[0].index, false)}
                        {groupOpen && count > 1 && (
                          <div className="flex flex-col gap-1.5 border-t border-hair px-2.5 py-2.5">
                            <button
                              type="button"
                              onClick={() => copyFirstToAll(serviceId)}
                              className="w-fit rounded-full bg-brand-soft px-3 py-1 text-[11px] font-semibold text-brand-ink hover:bg-brand hover:text-white"
                            >
                              Copiar datos del #1 a todos
                            </button>
                            <ul className="flex flex-col gap-1.5">
                              {units.map(({ line, index }, position) => (
                                <li key={line.uid} className="rounded-md border border-hair bg-paper">
                                  <div className="flex items-center gap-2 px-2 py-1.5">
                                    <button
                                      type="button"
                                      onClick={() => updateLine(line.uid, { open: !line.open })}
                                      aria-expanded={line.open}
                                      className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs"
                                    >
                                      <span className="font-semibold tabular-nums text-muted">#{position + 1}</span>
                                      <span className="truncate text-soft">
                                        {[line.details.color, line.details.size, line.details.dimensions]
                                          .filter(Boolean)
                                          .join(" · ") || "Sin detalles"}
                                      </span>
                                      <Icon
                                        name="down"
                                        size={12}
                                        className={`shrink-0 text-muted transition-transform ${line.open ? "rotate-180" : ""}`}
                                      />
                                    </button>
                                    <span className="relative w-20 shrink-0">
                                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted">
                                        $
                                      </span>
                                      <input
                                        aria-label={`Precio de ${service.name} #${position + 1}`}
                                        inputMode="decimal"
                                        value={line.price}
                                        onChange={(event) => updateLine(line.uid, { price: event.target.value })}
                                        aria-invalid={Boolean(itemErrors[itemKey(index, "price")])}
                                        className="w-full rounded-md border border-hair bg-paper py-1 pl-4 pr-1.5 text-right text-xs tabular-nums focus:border-brand focus:outline-none aria-[invalid=true]:border-attention"
                                      />
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => removeLine(line.uid)}
                                      aria-label={`Quitar ${service.name} #${position + 1}`}
                                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-attention-soft hover:text-attention"
                                    >
                                      <Icon name="close" size={12} />
                                    </button>
                                  </div>
                                  {renderUnit(
                                    line,
                                    index,
                                    line.open ||
                                      Object.keys(itemErrors).some((key) => key.startsWith(`items.${index}.`)),
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
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
              {pickupOrder ? (
                <ServiceIcon icon="truck" size={22} className="shrink-0 text-brand-ink" />
              ) : (
                <Icon name="calendar" size={20} className="shrink-0 text-brand-ink" />
              )}
              {schedule ? (
                <span className="min-w-0 leading-tight">
                  <span className="block font-medium">
                    {pickupOrder ? "Recogida" : "Cita"}: {formatDayLabel(schedule.pickup.date)},{" "}
                    {formatMinutes(schedule.pickup.startMin)}
                  </span>
                  {pickupOrder && (
                    <span className="block text-xs text-soft">
                      {schedule.delivery
                        ? `Entrega: ${formatDayLabel(schedule.delivery.date)}, ${formatMinutes(schedule.delivery.startMin)}`
                        : "Entrega sin programar"}
                    </span>
                  )}
                </span>
              ) : (
                <span className="font-medium text-soft">
                  {pickupOrder ? "Programar recogida y entrega (alfombras)" : "Programar fecha y hora de la cita"}
                </span>
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
            prefill={prefillFromSearch(customerSeed)}
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
        <Modal
          title={pickupOrder ? "Recogida y entrega de alfombras" : "Programar la cita"}
          onClose={() => setModal(null)}
          wide
        >
          <ScheduleForm
            technicians={technicians}
            initial={schedule}
            suggestedDuration={suggestedDuration}
            today={today}
            needsDestination={needsDestination}
            pickupMode={pickupOrder}
            customerAddresses={customer?.addresses ?? []}
            pickupAddressId={addressId}
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
