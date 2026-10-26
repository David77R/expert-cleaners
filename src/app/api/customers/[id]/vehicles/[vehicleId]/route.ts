import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";
import { deleteVehicle, updateVehicle } from "@/server/vehicles";

export function PATCH(request: Request, ctx: RouteContext<"/api/customers/[id]/vehicles/[vehicleId]">) {
  return handle(async () => {
    const { companyId } = await requireActor();
    const { id, vehicleId } = await ctx.params;
    return NextResponse.json({ vehicle: await updateVehicle(getDb(), companyId, id, vehicleId, await request.json()) });
  });
}

export function DELETE(_request: Request, ctx: RouteContext<"/api/customers/[id]/vehicles/[vehicleId]">) {
  return handle(async () => {
    const { companyId } = await requireActor();
    const { id, vehicleId } = await ctx.params;
    await deleteVehicle(getDb(), companyId, id, vehicleId);
    return NextResponse.json({ deleted: true });
  });
}
