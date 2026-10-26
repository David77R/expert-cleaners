import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getAppointment } from "@/server/appointments";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";

export function GET(_request: Request, ctx: RouteContext<"/api/appointments/[id]">) {
  return handle(async () => {
    const { companyId } = await requireActor();
    const { id } = await ctx.params;
    return NextResponse.json(await getAppointment(getDb(), companyId, id));
  });
}
