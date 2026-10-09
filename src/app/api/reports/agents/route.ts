import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getAgentReport } from "@/server/reports";
import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";

export function GET(request: Request) {
  return handle(async () => {
    const actor = await requireAdmin();
    const params = Object.fromEntries(new URL(request.url).searchParams);
    return NextResponse.json(await getAgentReport(getDb(), actor, params));
  });
}
