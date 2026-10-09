import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { createCustomer, searchCustomers } from "@/server/customers";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";

export function GET(request: Request) {
  return handle(async () => {
    await requireActor();
    const params = Object.fromEntries(new URL(request.url).searchParams);
    return NextResponse.json(await searchCustomers(getDb(), params));
  });
}

export function POST(request: Request) {
  return handle(async () => {
    await requireActor();
    const body = await request.json();
    return NextResponse.json(await createCustomer(getDb(), body), { status: 201 });
  });
}
