"use client";

import { useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { BookingCalendar } from "@/components/booking-calendar";
import { INPUT } from "@/components/form-kit";
import { Icon } from "@/components/icons";
import { ServiceIcon } from "@/components/service-icon";
import { formatMinutes } from "@/domain/appointment-rules";
import { splitFullAddress } from "@/domain/booking-address";
import { BOOKING_COPY } from "@/domain/booking-copy";
import { formatMoney } from "@/domain/invoice";
import { serviceIconOf } from "@/domain/service-icons";
import { VEHICLE_SIZES, priceForSize, type VehicleSize } from "@/domain/vehicles";
import type { BookingService } from "@/server/booking";
import type { AddressSuggestion } from "@/server/geocoding";

export type BookingDay = { date: string; open: boolean };

type Done = { code: string; date: string; startMin: number; priceCents: number; serviceName: string };

const FIELD = `${INPUT} py-2.5`;
const LABEL = "flex flex-col gap-1 text-sm font-medium";

const ADDRESS_FIELDS = ["line1", "city", "zip"] as const;
const CONTACT_FIELDS = ["firstName", "lastName", "phone"] as const;
const BURST = Array.from({ length: 14 }, (_, index) => {
  const angle = (index / 14) * Math.PI * 2;
  const distance = 70 + (index % 3) * 22;
  return { x: Math.round(Math.cos(angle) * distance), y: Math.round(Math.sin(angle) * distance), index };
});

function Step({
  number,
  title,
  done,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <section
      style={{ animationDelay: `${number * 70}ms` }}
      className={`booking-rise flex flex-col gap-3 rounded-xl border bg-paper p-4 shadow-sm transition-[border-color,box-shadow] duration-500 sm:p-5 ${
        done
          ? "border-[color-mix(in_srgb,var(--brand)_35%,transparent)] shadow-[0_14px_34px_-22px_color-mix(in_srgb,var(--brand)_70%,transparent)]"
          : "border-hair"
      }`}
    >
      <h2 className="font-display flex items-center gap-2.5 text-lg font-semibold">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm text-white transition-colors duration-300 ${
            done ? "bg-success" : "bg-brand"
          }`}
        >
          {done ? (
            <span key="done" className="booking-pop flex">
              <Icon name="check" size={15} />
            </span>
          ) : (
            number
          )}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function flash(form: HTMLFormElement | null, names: readonly string[]) {
  for (const name of names) {
    const field = form?.elements.namedItem(name);
    if (!(field instanceof HTMLInputElement) || !field.value) continue;
    field.classList.remove("booking-flash");
    void field.offsetWidth;
    field.classList.add("booking-flash");
  }
}

export function BookingForm({
  company,
  locale,
  services,
  days,
  preset,
  presetSize,
  place,
}: {
  company: string;
  locale: "es" | "en";
  services: BookingService[];
  days: BookingDay[];
  preset: string | null;
  presetSize: VehicleSize | null;
  place: { zip: string; city: string };
}) {
  const copy = BOOKING_COPY[locale];
  const [serviceId, setServiceId] = useState<string | null>(preset ?? (services.length === 1 ? services[0].id : null));
  const [size, setSize] = useState<VehicleSize | null>(presetSize);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<number[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [startMin, setStartMin] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [filled, setFilled] = useState<Record<string, boolean>>({ city: place.city !== "", zip: place.zip !== "" });
  const request = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);

  const service = services.find((item) => item.id === serviceId) ?? null;
  const priceCents = service ? priceForSize(service, size) : null;
  const dayLabel = useMemo(
    () => ({
      long: new Intl.DateTimeFormat(copy.locale, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }),
    }),
    [copy.locale],
  );
  const asDate = (value: string) => new Date(`${value}T12:00:00Z`);

  async function loadSlots(nextDate: string, nextService: string | null) {
    setDate(nextDate);
    setStartMin(null);
    if (!nextService) {
      setSlots(null);
      return;
    }
    const ticket = ++request.current;
    setLoadingSlots(true);
    try {
      const response = await fetch(
        `/api/public/booking/availability?${new URLSearchParams({ company, date: nextDate, service: nextService })}`,
      );
      const body = response.ok ? ((await response.json()) as { slots: number[] }) : { slots: [] };
      if (ticket === request.current) setSlots(body.slots);
    } catch {
      if (ticket === request.current) setSlots([]);
    } finally {
      if (ticket === request.current) setLoadingSlots(false);
    }
  }

  function chooseService(id: string) {
    setServiceId(id);
    if (date) void loadSlots(date, id);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const required = ["firstName", "lastName", "phone", "line1", "city", "zip"].filter((name) => !value(name));
    if (!serviceId) required.push("service");
    if (!size) required.push("size");
    if (!date || startMin === null) required.push("time");
    setMissing(required);
    if (required.length > 0) {
      setMessage(copy.missing);
      return;
    }
    setMessage(null);
    setSending(true);
    try {
      const response = await fetch(`/api/public/booking?${new URLSearchParams({ company })}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          size,
          make: value("make"),
          model: value("model"),
          color: value("color"),
          date,
          startMin,
          firstName: value("firstName"),
          lastName: value("lastName"),
          phone: value("phone"),
          email: value("email"),
          line1: value("line1"),
          unit: value("unit"),
          city: value("city"),
          zip: value("zip"),
          notes: value("notes"),
          website: value("website"),
        }),
      });
      const body = (await response.json().catch(() => null)) as { booking?: Done; error?: string } | null;
      if (!response.ok || !body?.booking) {
        const code = body?.error ?? "default";
        setMessage(copy.errors[code] ?? copy.errors.default);
        if (code === "slot_taken" && date) void loadSlots(date, serviceId);
        return;
      }
      setDone(body.booking);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setMessage(copy.errors.default);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <section className="booking-rise flex flex-col items-center gap-4 overflow-hidden rounded-xl border border-hair bg-paper px-5 py-10 text-center shadow-sm">
        <span className="relative flex h-16 w-16 items-center justify-center">
          <span className="booking-ring absolute inset-0 rounded-full bg-success/25" aria-hidden="true" />
          {BURST.map((dot) => (
            <span
              key={dot.index}
              aria-hidden="true"
              className={`booking-burst absolute left-1/2 top-1/2 h-2 w-2 rounded-full ${
                dot.index % 3 === 0 ? "bg-success" : dot.index % 3 === 1 ? "bg-brand" : "bg-warning"
              }`}
              style={
                { "--x": `${dot.x}px`, "--y": `${dot.y}px`, animationDelay: `${dot.index * 12}ms` } as CSSProperties
              }
            />
          ))}
          <span className="booking-pop relative flex h-16 w-16 items-center justify-center rounded-full bg-success text-white shadow-[0_12px_28px_-10px_rgb(42_127_34/0.7)]">
            <Icon name="check" size={32} />
          </span>
        </span>
        <h2 className="font-display text-2xl font-semibold">{copy.successTitle}</h2>
        <p className="max-w-sm text-sm text-soft">{copy.successBody(done.code)}</p>
        <dl className="w-full max-w-sm rounded-lg bg-canvas px-4 py-3 text-left text-sm">
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-soft">{done.serviceName}</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(done.priceCents)}</dd>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-soft first-letter:uppercase">{dayLabel.long.format(asDate(done.date))}</dt>
            <dd className="font-semibold tabular-nums">{formatMinutes(done.startMin)}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => {
            setDone(null);
            setFilled({ city: place.city !== "", zip: place.zip !== "" });
            setStartMin(null);
            setDate(null);
            setSlots(null);
          }}
          className="text-sm font-semibold text-brand-ink underline underline-offset-2"
        >
          {copy.another}
        </button>
      </section>
    );
  }

  const invalid = (name: string) => missing.includes(name);
  const steps = [
    serviceId !== null,
    size !== null,
    date !== null && startMin !== null,
    ADDRESS_FIELDS.every((name) => filled[name]),
    CONTACT_FIELDS.every((name) => filled[name]),
  ];
  const progress = steps.filter(Boolean).length;

  function track(name: string, value: string) {
    setFilled((current) =>
      current[name] === (value.trim() !== "") ? current : { ...current, [name]: value.trim() !== "" },
    );
  }

  function fillAddress(values: { line1?: string; city?: string; zip?: string }) {
    const form = formRef.current;
    for (const [name, value] of Object.entries(values)) {
      const field = form?.elements.namedItem(name);
      if (field instanceof HTMLInputElement && value) field.value = value;
    }
    setFilled((current) => ({
      ...current,
      line1: Boolean(values.line1) || current.line1,
      city: Boolean(values.city) || current.city,
      zip: Boolean(values.zip) || current.zip,
    }));
    flash(form, ["city", "zip"]);
  }

  function chooseAddress(suggestion: AddressSuggestion) {
    fillAddress({ line1: suggestion.line1, city: suggestion.city, zip: suggestion.zip });
  }

  function splitTyped(input: HTMLInputElement) {
    const parts = splitFullAddress(input.value);
    if (parts) fillAddress(parts);
  }
  const extraFor = (option: VehicleSize) =>
    service ? Math.max(0, priceForSize(service, option) - priceForSize(service, "sedan")) : 0;

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      onInput={(event) => {
        const target = event.target;
        if (target instanceof HTMLInputElement && target.name) track(target.name, target.value);
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      <Step number={1} title={copy.stepPackage} done={steps[0]}>
        <div role="radiogroup" aria-label={copy.stepPackage} className="flex flex-col gap-2">
          {services.map((item) => {
            const selected = item.id === serviceId;
            const prices = Object.values(item.sizePrices ?? {});
            const lowest = Math.min(item.basePriceCents, ...prices);
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => chooseService(item.id)}
                className={`flex items-center gap-3 rounded-lg border-2 px-3.5 py-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-300 ${
                  selected
                    ? "border-brand bg-brand-soft/50 shadow-[0_12px_28px_-18px_color-mix(in_srgb,var(--brand)_80%,transparent)]"
                    : "border-hair hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-sm"
                } ${invalid("service") && !serviceId ? "border-attention" : ""}`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                    selected ? "bg-brand text-white" : "bg-brand-soft text-brand-ink"
                  }`}
                >
                  <ServiceIcon icon={serviceIconOf(item)} size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-display block text-base font-semibold">{item.name}</span>
                  {item.description && <span className="block text-xs text-soft">{item.description}</span>}
                  <span className="mt-0.5 block text-xs text-muted">{copy.minutes(item.durationMin)}</span>
                </span>
                <span className="shrink-0 text-right">
                  {prices.length > 0 && <span className="block text-[11px] text-muted">{copy.from}</span>}
                  <span className="font-display text-lg font-semibold tabular-nums">{formatMoney(lowest)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Step>

      <Step number={2} title={copy.stepVehicle} done={steps[1]}>
        <div
          role="radiogroup"
          aria-label={copy.stepVehicle}
          className={`grid grid-cols-2 gap-2 sm:grid-cols-5 ${invalid("size") && !size ? "rounded-lg ring-2 ring-attention" : ""}`}
        >
          {VEHICLE_SIZES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={size === option}
              onClick={() => setSize(option)}
              className={`rounded-lg border-2 px-2 py-2.5 text-sm font-semibold transition-colors ${
                size === option ? "border-brand bg-brand text-white" : "border-hair hover:border-brand/40"
              }`}
            >
              {copy.sizes[option]}
              {service && extraFor(option) > 0 && (
                <span className={`block text-[11px] font-medium ${size === option ? "text-white/80" : "text-brand"}`}>
                  +{formatMoney(extraFor(option))}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-3">
          <label className={LABEL}>
            {copy.make}
            <input name="make" maxLength={40} autoComplete="off" className={FIELD} />
          </label>
          <label className={LABEL}>
            {copy.model}
            <input name="model" maxLength={40} autoComplete="off" className={FIELD} />
          </label>
          <label className={LABEL}>
            {copy.color}
            <input name="color" maxLength={30} autoComplete="off" className={FIELD} />
          </label>
        </div>
      </Step>

      <Step number={3} title={copy.stepWhen} done={steps[2]}>
        <BookingCalendar
          days={days}
          selected={date}
          onSelect={(day) => void loadSlots(day, serviceId)}
          locale={copy.locale}
          labels={{ previous: copy.previousMonth, next: copy.nextMonth, closed: copy.closed }}
        />
        {date && (
          <p className="text-sm font-semibold text-ink first-letter:uppercase">{dayLabel.long.format(asDate(date))}</p>
        )}
        <div className={invalid("time") && startMin === null ? "rounded-lg ring-2 ring-attention" : ""}>
          {!date || !serviceId ? (
            <p className="text-sm text-muted">{copy.pickDay}</p>
          ) : loadingSlots ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label={copy.loadingTimes} role="status">
              {Array.from({ length: 8 }, (_, index) => (
                <span key={index} className="h-[42px] animate-pulse rounded-lg bg-neutral-soft" />
              ))}
            </div>
          ) : slots && slots.length === 0 ? (
            <p className="text-sm text-soft">{copy.noTimes}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(slots ?? []).map((slot, index) => (
                <button
                  key={`${date}-${slot}`}
                  type="button"
                  onClick={() => setStartMin(slot)}
                  aria-pressed={slot === startMin}
                  style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
                  className={`booking-pop-in rounded-lg border-2 py-2 text-sm font-semibold tabular-nums transition-[background-color,border-color,color,transform] duration-200 hover:-translate-y-0.5 ${
                    slot === startMin
                      ? "border-brand bg-brand text-white shadow-[0_8px_18px_-10px_color-mix(in_srgb,var(--brand)_90%,transparent)]"
                      : "border-hair hover:border-brand/40"
                  }`}
                >
                  {formatMinutes(slot)}
                </button>
              ))}
            </div>
          )}
        </div>
      </Step>

      <Step number={4} title={copy.stepWhere} done={steps[3]}>
        <div className={LABEL}>
          <label htmlFor="booking-line1">{copy.street}</label>
          <AddressAutocomplete
            control={{ id: "booking-line1", "aria-invalid": invalid("line1"), "aria-describedby": undefined }}
            name="line1"
            placeholder={copy.streetHint}
            endpoint={`/api/public/booking/address?${new URLSearchParams({ company })}`}
            labels={copy.address}
            onChoose={chooseAddress}
            onBlur={splitTyped}
            className={`${FIELD} w-full aria-[invalid=true]:border-attention`}
          />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-3">
          <label className={LABEL}>
            <span>
              {copy.unit} <span className="font-normal text-muted">({copy.optional})</span>
            </span>
            <input name="unit" autoComplete="address-line2" maxLength={30} className={FIELD} />
          </label>
          <label className={LABEL}>
            {copy.city}
            <input
              name="city"
              defaultValue={place.city}
              autoComplete="address-level2"
              maxLength={60}
              aria-invalid={invalid("city")}
              className={`${FIELD} aria-[invalid=true]:border-attention`}
            />
          </label>
          <label className={LABEL}>
            {copy.zip}
            <input
              name="zip"
              defaultValue={place.zip}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={10}
              aria-invalid={invalid("zip")}
              className={`${FIELD} aria-[invalid=true]:border-attention`}
            />
          </label>
        </div>
      </Step>

      <Step number={5} title={copy.stepContact} done={steps[4]}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
          <label className={LABEL}>
            {copy.firstName}
            <input
              name="firstName"
              autoComplete="given-name"
              maxLength={60}
              aria-invalid={invalid("firstName")}
              className={`${FIELD} aria-[invalid=true]:border-attention`}
            />
          </label>
          <label className={LABEL}>
            {copy.lastName}
            <input
              name="lastName"
              autoComplete="family-name"
              maxLength={60}
              aria-invalid={invalid("lastName")}
              className={`${FIELD} aria-[invalid=true]:border-attention`}
            />
          </label>
          <label className={LABEL}>
            {copy.phone}
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={20}
              aria-invalid={invalid("phone")}
              className={`${FIELD} aria-[invalid=true]:border-attention`}
            />
          </label>
          <label className={LABEL}>
            <span>
              {copy.email} <span className="font-normal text-muted">({copy.optional})</span>
            </span>
            <input name="email" type="email" autoComplete="email" maxLength={120} className={FIELD} />
          </label>
        </div>
        <label className={LABEL}>
          <span>
            {copy.notes} <span className="font-normal text-muted">({copy.optional})</span>
          </span>
          <textarea
            name="notes"
            rows={3}
            maxLength={500}
            placeholder={copy.notesHint}
            className={`${FIELD} resize-y`}
          />
        </label>
        <input
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-px w-px opacity-0"
        />
      </Step>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 overflow-hidden border-t border-hair bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3.5 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <div
          role="progressbar"
          aria-label={copy.progress(progress, steps.length)}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={progress}
          className="absolute inset-x-0 top-0 h-1 bg-neutral-soft"
        >
          <div
            className="h-full rounded-r-full bg-[linear-gradient(90deg,var(--brand),var(--success))] transition-[width] duration-700 ease-out"
            style={{ width: `${(progress / steps.length) * 100}%` }}
          />
        </div>
        {message && (
          <p role="alert" className="text-sm font-medium text-attention">
            {message}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 leading-tight">
            <span className="block text-xs text-soft">
              {copy.total} · {copy.progress(progress, steps.length)}
            </span>
            <span
              key={priceCents ?? "none"}
              className="booking-pop font-display block text-xl font-semibold tabular-nums"
            >
              {priceCents === null ? "—" : formatMoney(priceCents)}
            </span>
            {date && startMin !== null && (
              <span className="block truncate text-xs text-soft first-letter:uppercase">
                {dayLabel.long.format(asDate(date))} · {formatMinutes(startMin)}
              </span>
            )}
          </span>
          <button
            type="submit"
            disabled={sending}
            className="booking-shine shrink-0 rounded-lg px-6 py-3 text-base font-semibold text-white shadow-[0_10px_24px_-12px_color-mix(in_srgb,var(--brand)_90%,transparent)] transition-[transform,opacity] duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
          >
            {sending ? copy.sending : copy.submit}
          </button>
        </div>
      </div>
    </form>
  );
}
