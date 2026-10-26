import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";
import { createVehicle, listVehicles } from "@/server/vehicles";

export function GET(_request: Request, ctx: RouteContext<"/api/customers/[id]/vehicles">) {
  return handle(async () => {
    await requireActor();
    const { id } = await ctx.params;
    return NextResponse.json({ vehicles: await listVehicles(getDb(), id) });
  });
}

export function POST(request: Request, ctx: RouteContext<"/api/customers/[id]/vehicles">) {
  return handle(async () => {
    await requireActor();
    const { id } = await ctx.params;
    const vehicle = await createVehicle(getDb(), id, await request.json());
    return NextResponse.json({ vehicle }, { status: 201 });
  });
}
