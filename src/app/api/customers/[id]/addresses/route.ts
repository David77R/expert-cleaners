import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { addAddress } from "@/server/customers";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";

export function POST(request: Request, ctx: RouteContext<"/api/customers/[id]/addresses">) {
  return handle(async () => {
    await requireActor();
    const { id } = await ctx.params;
    const body = await request.json();
    return NextResponse.json(await addAddress(getDb(), id, body), { status: 201 });
  });
}
