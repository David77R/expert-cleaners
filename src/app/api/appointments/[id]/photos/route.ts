import { NextResponse } from "next/server";
import { assertTechnicianAppointment } from "@/server/technician-access";
import { getDb } from "@/db/client";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";
import { listPhotos, uploadPhoto } from "@/server/photos";
import { getPhotoStorage } from "@/server/storage";
import { readPhotoUploadForm } from "@/server/uploads";

export function GET(_request: Request, ctx: RouteContext<"/api/appointments/[id]/photos">) {
  return handle(async () => {
    const actor = await requireActor({ allowTechnician: true });
    const { id } = await ctx.params;
    await assertTechnicianAppointment(getDb(), actor, id);
    return NextResponse.json({ photos: await listPhotos(getDb(), getPhotoStorage(), actor.companyId, id) });
  });
}

export function POST(request: Request, ctx: RouteContext<"/api/appointments/[id]/photos">) {
  return handle(async () => {
    const actor = await requireActor({ allowTechnician: true });
    const { id } = await ctx.params;
    await assertTechnicianAppointment(getDb(), actor, id);
    const { bytes, itemId, label } = await readPhotoUploadForm(request);
    const photo = await uploadPhoto(getDb(), getPhotoStorage(), actor, id, bytes, itemId, label);
    return NextResponse.json({ photo }, { status: 201 });
  });
}
