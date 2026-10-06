import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireActor } from "@/server/auth";
import { runAction } from "@/server/actions";
import { handle } from "@/server/http";

export function POST(request: Request, ctx: RouteContext<"/api/appointments/[id]/actions">) {
  return handle(async () => {
    const actor = await requireActor();
    const { id } = await ctx.params;
    const body = await request.json();
    return NextResponse.json(await runAction(getDb(), actor, id, body));
  });
}
