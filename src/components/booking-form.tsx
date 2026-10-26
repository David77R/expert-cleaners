"use client";

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { INPUT } from "@/components/form-kit";
import { Icon } from "@/components/icons";
import { ServiceIcon } from "@/components/service-icon";
import { formatMinutes } from "@/domain/appointment-rules";
import { BOOKING_COPY } from "@/domain/booking-copy";
import { formatMoney } from "@/domain/invoice";
import { serviceIconOf } from "@/domain/service-icons";
import { VEHICLE_SIZES, priceForSize, type VehicleSize } from "@/domain/vehicles";
import type { BookingService } from "@/server/booking";

export type BookingDay = { date: string; open: boolean };

type Done = { code: string; date: string; startMin: number; priceCents: number; serviceName: string };

const FIELD = `${INPUT} py-2.5`;
const LABEL = "flex flex-col gap-1 text-sm font-medium";

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-hair bg-paper p-4 shadow-sm sm:p-5">
      <h2 className="font-display flex items-center gap-2.5 text-lg font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-white">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function BookingForm({
  company,
  locale,
  services,
  days,
  preset,
}: {
  company: string;
  locale: "es" | "en";
  services: BookingService[];
  days: BookingDay[];
  preset: string | null;
}) {
  const copy = BOOKING_COPY[locale];
  const [serviceId, setServiceId] = useState<string | null>(preset ?? (services.length === 1 ? services[0].id : null));
  const [size, setSize] = useState<VehicleSize | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<number[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [startMin, setStartMin] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const request = useRef(0);

  const service = services.find((item) => item.id === serviceId) ?? null;
  const priceCents = service ? priceForSize(service, size) : null;
  const dayLabel = useMemo(
    () => ({
      weekday: new Intl.DateTimeFormat(copy.locale, { weekday: "short", timeZone: "UTC" }),
      month: new Intl.DateTimeFormat(copy.locale, { month: "short", timeZone: "UTC" }),
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
      <section className="flex flex-col items-center gap-4 rounded-xl border border-hair bg-paper px-5 py-10 text-center shadow-sm">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
          <Icon name="check" size={28} />
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

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Step number={1} title={copy.stepPackage}>
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
                className={`flex items-center gap-3 rounded-lg border-2 px-3.5 py-3 text-left transition-colors ${
                  selected ? "border-brand bg-brand-soft/50" : "border-hair hover:border-brand/40"
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

      <Step number={2} title={copy.stepVehicle}>
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

      <Step number={3} title={copy.stepWhen}>
        <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5">
          {days.map((day) => {
            const selected = day.date === date;
            const value = asDate(day.date);
            return (
              <button
                key={day.date}
                type="button"
                disabled={!day.open}
                onClick={() => void loadSlots(day.date, serviceId)}
                aria-pressed={selected}
                className={`flex w-16 shrink-0 snap-start flex-col items-center rounded-lg border-2 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                  selected ? "border-brand bg-brand text-white" : "border-hair bg-paper hover:border-brand/40"
                }`}
              >
                <span className="text-[11px] font-semibold uppercase">{dayLabel.weekday.format(value)}</span>
                <span className="font-display text-xl font-semibold tabular-nums">{Number(day.date.slice(8, 10))}</span>
                <span className="text-[11px] capitalize">{day.open ? dayLabel.month.format(value) : copy.closed}</span>
              </button>
            );
          })}
        </div>
        <div className={invalid("time") && startMin === null ? "rounded-lg ring-2 ring-attention" : ""}>
          {!date || !serviceId ? (
            <p className="text-sm text-muted">{copy.pickDay}</p>
          ) : loadingSlots ? (
            <p className="text-sm text-muted">{copy.loadingTimes}</p>
          ) : slots && slots.length === 0 ? (
            <p className="text-sm text-soft">{copy.noTimes}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(slots ?? []).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setStartMin(slot)}
                  aria-pressed={slot === startMin}
                  className={`rounded-lg border-2 py-2 text-sm font-semibold tabular-nums transition-colors ${
                    slot === startMin ? "border-brand bg-brand text-white" : "border-hair hover:border-brand/40"
                  }`}
                >
                  {formatMinutes(slot)}
                </button>
              ))}
            </div>
          )}
        </div>
      </Step>

      <Step number={4} title={copy.stepWhere}>
        <label className={LABEL}>
          {copy.street}
          <input
            name="line1"
            autoComplete="address-line1"
            maxLength={120}
            aria-invalid={invalid("line1")}
            className={`${FIELD} aria-[invalid=true]:border-attention`}
          />
        </label>
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
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={10}
              aria-invalid={invalid("zip")}
              className={`${FIELD} aria-[invalid=true]:border-attention`}
            />
          </label>
        </div>
      </Step>

      <Step number={5} title={copy.stepContact}>
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

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-hair bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        {message && (
          <p role="alert" className="text-sm font-medium text-attention">
            {message}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 leading-tight">
            <span className="block text-xs text-soft">{copy.total}</span>
            <span className="font-display block text-xl font-semibold tabular-nums">
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
            className="shrink-0 rounded-lg bg-brand px-6 py-3 text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {sending ? copy.sending : copy.submit}
          </button>
        </div>
      </div>
    </form>
  );
}
