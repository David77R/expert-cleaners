import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getService, updateService } from "@/server/services";
import { requireActor, requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";

export function GET(_request: Request, ctx: RouteContext<"/api/services/[id]">) {
  return handle(async () => {
    await requireActor();
    const { id } = await ctx.params;
    return NextResponse.json(await getService(getDb(), id));
  });
}

export function PATCH(request: Request, ctx: RouteContext<"/api/services/[id]">) {
  return handle(async () => {
    const actor = await requireAdmin();
    const { id } = await ctx.params;
    const body = await request.json();
    return NextResponse.json(await updateService(getDb(), actor, id, body));
  });
}
