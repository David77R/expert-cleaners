import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { createService, listServices } from "@/server/services";
import { requireActor, requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";

export function GET(request: Request) {
  return handle(async () => {
    const actor = await requireActor();
    const params = Object.fromEntries(new URL(request.url).searchParams);
    return NextResponse.json(await listServices(getDb(), actor.companyId, params, actor));
  });
}

export function POST(request: Request) {
  return handle(async () => {
    const actor = await requireAdmin();
    const body = await request.json();
    return NextResponse.json(await createService(getDb(), actor, body), { status: 201 });
  });
}
