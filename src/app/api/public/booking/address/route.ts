import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { brandOf } from "@/domain/companies";
import { bookingCompany } from "@/server/booking";
import { suggestAddresses } from "@/server/geocoding";
import { handle } from "@/server/http";
import { allowRequest } from "@/server/rate-limit";

export function GET(request: Request) {
  return handle(async () => {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!allowRequest(`address:${ip}`, 60, 10 * 60 * 1000)) {
      return NextResponse.json({ suggestions: [] }, { status: 429 });
    }
    const url = new URL(request.url);
    const company = await bookingCompany(getDb(), url.searchParams.get("company") ?? "");
    const query = (url.searchParams.get("q") ?? "").slice(0, 200);
    return NextResponse.json({ suggestions: await suggestAddresses(query, brandOf(company).location) });
  });
}
