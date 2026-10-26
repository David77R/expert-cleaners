import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { handle } from "@/server/http";
import { bookingAvailability, bookingCompany } from "@/server/booking";

export function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const db = getDb();
    const company = await bookingCompany(db, url.searchParams.get("company") ?? "");
    const slots = await bookingAvailability(
      db,
      company,
      url.searchParams.get("date") ?? "",
      url.searchParams.get("service") ?? "",
    );
    return NextResponse.json({ slots }, { headers: { "Cache-Control": "no-store" } });
  });
}
