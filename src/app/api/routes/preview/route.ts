import { NextResponse } from "next/server";
import { routePreviewSchema } from "@/domain/schemas";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";
import { getRouter } from "@/server/routing";

export function POST(request: Request) {
  return handle(async () => {
    await requireActor();
    const body = await request.json();
    const { points } = routePreviewSchema.parse(body);

    const router = getRouter();
    if (!router) return NextResponse.json({ route: null });

    return NextResponse.json({ route: await router.route(points) });
  });
}
