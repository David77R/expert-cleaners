import { NextResponse } from "next/server";
import { requireActor } from "@/server/auth";
import { suggestAddresses } from "@/server/geocoding";
import { handle } from "@/server/http";

export function GET(request: Request) {
  return handle(async () => {
    await requireActor();
    const query = new URL(request.url).searchParams.get("q") ?? "";
    return NextResponse.json({ suggestions: await suggestAddresses(query.slice(0, 200)) });
  });
}
