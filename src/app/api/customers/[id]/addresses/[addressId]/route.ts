import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { deleteAddress, updateAddress } from "@/server/customers";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";

export function PATCH(request: Request, ctx: RouteContext<"/api/customers/[id]/addresses/[addressId]">) {
  return handle(async () => {
    const { companyId } = await requireActor();
    const { id, addressId } = await ctx.params;
    const body = await request.json();
    return NextResponse.json(await updateAddress(getDb(), companyId, id, addressId, body));
  });
}

export function DELETE(_request: Request, ctx: RouteContext<"/api/customers/[id]/addresses/[addressId]">) {
  return handle(async () => {
    const { companyId } = await requireActor();
    const { id, addressId } = await ctx.params;
    return NextResponse.json(await deleteAddress(getDb(), companyId, id, addressId));
  });
}
