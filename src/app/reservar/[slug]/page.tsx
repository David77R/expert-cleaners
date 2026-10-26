import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BookingForm, type BookingDay } from "@/components/booking-form";
import { BrandMark } from "@/components/brand-mark";
import { BrandProvider } from "@/components/brand-provider";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/appointment-rules";
import { bookingWindow } from "@/domain/booking";
import { BOOKING_COPY } from "@/domain/booking-copy";
import { weekdayIndex } from "@/domain/calendar-view";
import { brandIcon, brandOf, brandStyle } from "@/domain/companies";
import { enumerateDates, minutesNowIn, todayIn } from "@/domain/date-rules";
import { bookingCompany, bookingServices } from "@/server/booking";

export const dynamic = "force-dynamic";

const loadCompany = cache(async (slug: string) => {
  try {
    return await bookingCompany(getDb(), slug);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }
});

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export async function generateMetadata({ params }: PageProps<"/reservar/[slug]">): Promise<Metadata> {
  const company = await loadCompany((await params).slug);
  const copy = BOOKING_COPY[company.settings.booking.locale];
  const brand = brandOf(company);
  const title = `${copy.title} · ${brand.shortName}`;
  const image = brand.logo?.src ?? brandIcon(brand, "icon-512.png");
  return {
    title,
    description: copy.subtitle,
    icons: { apple: brandIcon(brand, "apple-icon.png"), icon: brandIcon(brand, "icon-192.png") },
    openGraph: { title, description: copy.subtitle, siteName: brand.name, type: "website", images: [image] },
  };
}

export default async function BookingPage({ params, searchParams }: PageProps<"/reservar/[slug]">) {
  const company = await loadCompany((await params).slug);
  const brand = brandOf(company);
  const copy = BOOKING_COPY[brand.booking.locale];
  const query = await searchParams;
  const services = await bookingServices(getDb(), company);
  const window = bookingWindow(todayIn(), minutesNowIn(), brand.booking.minNoticeHours, brand.booking.maxDaysAhead);
  const days: BookingDay[] = enumerateDates(window.firstDate, window.lastDate).map((date) => ({
    date,
    open: brand.booking.hours[weekdayIndex(date)] != null,
  }));
  const wanted = (first(query.package) || first(query.paquete)).trim().toLowerCase();
  const preset =
    services.find((service) => service.slug === wanted || service.name.toLowerCase() === wanted)?.id ?? null;
  const zip = first(query.zip).trim();
  const city = first(query.city).trim().replace(/\s+/g, " ");
  const place = {
    zip: /^\d{5}$/.test(zip) ? zip : "",
    city: /^[\p{L} .'-]{2,60}$/u.test(city) ? city : "",
  };

  return (
    <BrandProvider brand={brand}>
      <main className="flex min-h-dvh flex-col bg-canvas" style={brandStyle(brand)}>
        <header className="bg-rail px-4 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
          <div className="mx-auto flex max-w-2xl flex-col items-start gap-4">
            <BrandMark brand={brand} size="lg" />
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{copy.title}</h1>
              <p className="mt-1 text-sm text-rail-text">{copy.subtitle}</p>
            </div>
          </div>
        </header>
        <div className="mx-auto -mt-4 w-full max-w-2xl flex-1 px-4 pb-16">
          <BookingForm
            company={company.slug}
            locale={brand.booking.locale}
            services={services}
            days={days}
            preset={preset}
            place={place}
          />
        </div>
      </main>
    </BrandProvider>
  );
}
