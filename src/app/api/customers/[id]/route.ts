import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getCustomer, updateCustomer } from "@/server/customers";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";

export function GET(_request: Request, ctx: RouteContext<"/api/customers/[id]">) {
  return handle(async () => {
    await requireActor();
    const { id } = await ctx.params;
    return NextResponse.json(await getCustomer(getDb(), id));
  });
}

export function PATCH(request: Request, ctx: RouteContext<"/api/customers/[id]">) {
  return handle(async () => {
    await requireActor();
    const { id } = await ctx.params;
    const body = await request.json();
    return NextResponse.json(await updateCustomer(getDb(), id, body));
  });
}
