import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getRange } from "@/server/appointments";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";

export function GET(request: Request) {
  return handle(async () => {
    await requireActor();
    const params = Object.fromEntries(new URL(request.url).searchParams);
    return NextResponse.json(await getRange(getDb(), params));
  });
}
