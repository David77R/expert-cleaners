import { NextResponse } from "next/server";
import { hideCustomerPhones } from "@/domain/phone-privacy";
import { getDb } from "@/db/client";
import { getRange } from "@/server/appointments";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";

export function GET(request: Request) {
  return handle(async () => {
    const actor = await requireActor();
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const range = await getRange(getDb(), actor.companyId, params);
    return NextResponse.json({ ...range, appointments: hideCustomerPhones(actor, range.appointments) });
  });
}
