import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";
import { listPhotos, uploadPhoto } from "@/server/photos";
import { getPhotoStorage } from "@/server/storage";
import { readPhotoUpload } from "@/server/uploads";

export function GET(_request: Request, ctx: RouteContext<"/api/appointments/[id]/photos">) {
  return handle(async () => {
    await requireActor();
    const { id } = await ctx.params;
    return NextResponse.json({ photos: await listPhotos(getDb(), getPhotoStorage(), id) });
  });
}

export function POST(request: Request, ctx: RouteContext<"/api/appointments/[id]/photos">) {
  return handle(async () => {
    const actor = await requireActor();
    const { id } = await ctx.params;
    const bytes = await readPhotoUpload(request);
    const photo = await uploadPhoto(getDb(), getPhotoStorage(), actor, id, bytes);
    return NextResponse.json({ photo }, { status: 201 });
  });
}
