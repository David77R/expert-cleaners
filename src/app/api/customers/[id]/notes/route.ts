import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { addCustomerNote } from "@/server/customers";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";

export function POST(request: Request, ctx: RouteContext<"/api/customers/[id]/notes">) {
  return handle(async () => {
    const actor = await requireActor();
    const { id } = await ctx.params;
    const body = await request.json();
    return NextResponse.json(await addCustomerNote(getDb(), actor, id, body), { status: 201 });
  });
}
