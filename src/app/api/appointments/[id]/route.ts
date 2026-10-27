import { NextResponse } from "next/server";
import { hideCustomerPhones } from "@/domain/phone-privacy";
import { getDb } from "@/db/client";
import { getAppointment } from "@/server/appointments";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";

export function GET(_request: Request, ctx: RouteContext<"/api/appointments/[id]">) {
  return handle(async () => {
    const actor = await requireActor();
    const { id } = await ctx.params;
    const [appointment] = hideCustomerPhones(actor, [await getAppointment(getDb(), actor.companyId, id)]);
    return NextResponse.json(appointment);
  });
}
