import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { handle } from "@/server/http";
import { bookingCompany, createBooking } from "@/server/booking";
import { allowRequest } from "@/server/rate-limit";

export function POST(request: Request) {
  return handle(async () => {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!allowRequest(`booking:${ip}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    const db = getDb();
    const company = await bookingCompany(db, new URL(request.url).searchParams.get("company") ?? "");
    const booking = await createBooking(db, company, await request.json());
    return NextResponse.json({ booking }, { status: 201 });
  });
}
