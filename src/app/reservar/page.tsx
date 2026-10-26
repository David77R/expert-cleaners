import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingForm, type BookingDay } from "@/components/booking-form";
import { BrandMark } from "@/components/brand-mark";
import { client } from "@/config/clients";
import { getDb } from "@/db/client";
import { bookingWindow } from "@/domain/booking";
import { BOOKING_COPY } from "@/domain/booking-copy";
import { weekdayIndex } from "@/domain/calendar-view";
import { enumerateDates, minutesNowIn, todayIn } from "@/domain/date-rules";
import { bookingCompany, bookingServices } from "@/server/booking";
import { DomainError } from "@/domain/appointment-rules";

export const dynamic = "force-dynamic";

const copy = BOOKING_COPY[client.booking.locale];

export const metadata: Metadata = {
  title: `${copy.title} · ${client.shortName}`,
  description: copy.subtitle,
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function BookingPage({ searchParams }: PageProps<"/reservar">) {
  if (!client.features.publicBooking) notFound();
  const params = await searchParams;
  const db = getDb();
  const company = await bookingCompany(db, client.id).catch((error) => {
    if (error instanceof DomainError) notFound();
    throw error;
  });
  const services = await bookingServices(db, company);
  const window = bookingWindow(todayIn(), minutesNowIn(), client.booking.minNoticeHours, client.booking.maxDaysAhead);
  const days: BookingDay[] = enumerateDates(window.firstDate, window.lastDate).map((date) => ({
    date,
    open: client.booking.hours[weekdayIndex(date)] != null,
  }));
  const wanted = (first(params.package) || first(params.paquete)).trim().toLowerCase();
  const preset =
    services.find((service) => service.slug === wanted || service.name.toLowerCase() === wanted)?.id ?? null;

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="bg-rail px-4 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
        <div className="mx-auto flex max-w-2xl flex-col items-start gap-4">
          <BrandMark size="lg" />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{copy.title}</h1>
            <p className="mt-1 text-sm text-rail-text">{copy.subtitle}</p>
          </div>
        </div>
      </header>
      <div className="mx-auto -mt-4 w-full max-w-2xl flex-1 px-4 pb-16">
        <BookingForm
          company={company.slug}
          locale={client.booking.locale}
          services={services}
          days={days}
          preset={preset}
        />
      </div>
    </main>
  );
}
