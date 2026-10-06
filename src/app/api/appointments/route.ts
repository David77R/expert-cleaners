import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { dayQuerySchema } from "@/domain/schemas";
import { createAppointment, getDay } from "@/server/appointments";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";

export function GET(request: Request) {
  return handle(async () => {
    await requireActor();
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = dayQuerySchema.parse(params);
    return NextResponse.json(await getDay(getDb(), query.date, query.technicianId));
  });
}

export function POST(request: Request) {
  return handle(async () => {
    const actor = await requireActor();
    const body = await request.json();
    const result = await createAppointment(getDb(), actor, body);
    return NextResponse.json(result, { status: 201 });
  });
}
