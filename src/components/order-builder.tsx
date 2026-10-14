"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { scheduleOrderAction } from "@/app/orders/new/actions";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { CustomerPicker } from "@/components/customer-picker";
import { INPUT } from "@/components/form-kit";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/modal";
import { QuickCustomerForm } from "@/components/quick-customer-form";
import { ServiceIcon } from "@/components/service-icon";
import {
  centsToDollars,
  fieldsForService,
  itemKey,
  itemSpecKey,
  parseDollars,
  validateItems,
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

type Line = { uid: number; serviceId: string; price: string; specs: Record<string, string>; open: boolean };

type Visit = { date: string; startMin: number; durationMin: number; technicianId: string };

type Schedule = {
  pickup: Visit;
  delivery: Visit | null;
  readyDate: string;
  destination: ReturnType<typeof destinationFromValues> | null;
};

type Done = { id: string; code: string; date: string; conflicts: number; message: string; phone: string };

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
}: {
  services: FormService[];
  technicians: FormTechnician[];
  today: string;
}) {
  const categories = [...new Set(services.map((service) => service.category))];
  const [category, setCategory] = useState(categories[0] ?? "");
  const [lines, setLines] = useState<Line[]>([]);
  const nextUid = useRef(1);
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
  const visible = services.filter((service) => service.category === category);
  const totalCents = lines.reduce((sum, line) => sum + lineCents(line, byId.get(line.serviceId)), 0);
  const needsDestination = lines.some((line) => byId.get(line.serviceId)?.twoAddresses);
  const suggestedDuration = Math.min(
    720,
    Math.max(15, lines.reduce((sum, line) => sum + (byId.get(line.serviceId)?.durationMin ?? 0), 0) || 60),
  );

  function addService(service: FormService) {
    const uid = nextUid.current;
    nextUid.current += 1;
    const hasRequired = fieldsForService(service).some((field) => field.required);
    setLines((current) => [
      ...current.map((line) => ({ ...line, open: false })),
      { uid, serviceId: service.id, price: centsToDollars(service.basePriceCents), specs: {}, open: hasRequired },
    ]);
    setDone(null);
  }

  function updateLine(uid: number, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.uid === uid ? { ...line, ...patch } : line)));
  }

  function removeLine(uid: number) {
    setLines((current) => current.filter((line) => line.uid !== uid));
    setItemErrors({});
  }

  function chooseCustomer(next: PickerCustomer) {
    setCustomer(next);
    setAddressId(next.addresses[0]?.id ?? "");
    setMessage(null);
  }

  function reset() {
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
    const payload = {
      customerId: chosen.id,
      addressId,
      technicianId: plan.pickup.technicianId,
      date: plan.pickup.date,
      startMin: plan.pickup.startMin,
      durationMin: plan.pickup.durationMin,
      items: inputs,
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
        message: confirmationMessage({
          customerName: chosen.firstName,
          code: result.code,
          pickup: plan.pickup,
          delivery: plan.delivery,
          items: summary,
          totalCents,
        }),
      });
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_25rem]">
      <section className="flex min-w-0 flex-col gap-4">
        <div role="tablist" aria-label="Categorías" className="flex flex-wrap gap-1 border-b border-hair">
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={name === category}
              onClick={() => setCategory(name)}
              className={`-mb-px border-b-[3px] px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors ${
                name === category ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="rounded-md border border-dashed border-hair bg-paper px-4 py-10 text-center text-sm text-muted">
            Todavía no hay servicios activos. El súper admin puede crearlos en Servicios.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {visible.map((service) => {
              const count = lines.filter((line) => line.serviceId === service.id).length;
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => addService(service)}
                  className="group relative flex aspect-square flex-col items-center justify-center gap-2.5 rounded-md border border-hair bg-paper p-3 text-center shadow-[0_1px_0_rgba(18,24,31,0.04)] transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md"
                >
                  {count > 0 && (
                    <span className="font-display absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-white">
                      {count}
                    </span>
                  )}
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand-ink transition-colors group-hover:bg-brand group-hover:text-white">
                    <ServiceIcon icon={service.iconKey ?? guessServiceIcon(service)} size={30} />
                  </span>
                  <span className="line-clamp-2 text-sm font-medium leading-tight">{service.name}</span>
                </button>
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
                            {fields.length > 0 && (
                              <Icon
                                name="down"
                                size={14}
                                className={`shrink-0 text-muted transition-transform ${line.open ? "rotate-180" : ""}`}
                              />
                            )}
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
                        {line.open && fields.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 border-t border-hair px-2.5 py-2.5">
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
