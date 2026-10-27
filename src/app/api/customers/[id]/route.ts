import { NextResponse } from "next/server";
import { hidePhone } from "@/domain/phone-privacy";
import { getDb } from "@/db/client";
import { getCustomer, updateCustomer } from "@/server/customers";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";

export function GET(_request: Request, ctx: RouteContext<"/api/customers/[id]">) {
  return handle(async () => {
    const actor = await requireActor();
    const { id } = await ctx.params;
    return NextResponse.json(hidePhone(actor, await getCustomer(getDb(), actor.companyId, id)));
  });
}

export function PATCH(request: Request, ctx: RouteContext<"/api/customers/[id]">) {
  return handle(async () => {
    const { companyId } = await requireActor();
    const { id } = await ctx.params;
    const body = await request.json();
    return NextResponse.json(await updateCustomer(getDb(), companyId, id, body));
  });
}
