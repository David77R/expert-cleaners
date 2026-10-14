import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";
import { saveRouteDraft, deleteRouteDraft } from "@/server/route-drafts";

export function POST(request: Request) {
  return handle(async () => {
    const actor = await requireActor();
    const body = await request.json();
    const db = getDb();
    const saved = await saveRouteDraft(db, actor, body);
    return NextResponse.json({ draft: saved });
  });
}

export function DELETE(request: Request) {
  return handle(async () => {
    await requireActor();
    const body = await request.json();
    const db = getDb();
    await deleteRouteDraft(db, body);
    return NextResponse.json({ ok: true });
  });
}
