import { NextResponse } from "next/server";
import { assertTechnicianAppointment } from "@/server/technician-access";
import { getDb } from "@/db/client";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";
import { deletePhoto } from "@/server/photos";
import { getPhotoStorage } from "@/server/storage";

export function DELETE(_request: Request, ctx: RouteContext<"/api/appointments/[id]/photos/[photoId]">) {
  return handle(async () => {
    const actor = await requireActor({ allowTechnician: true });
    const { id, photoId } = await ctx.params;
    await assertTechnicianAppointment(getDb(), actor, id);
    return NextResponse.json(await deletePhoto(getDb(), getPhotoStorage(), actor, id, photoId));
  });
}
