import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { createCustomer, searchCustomers } from "@/server/customers";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";

export function GET(request: Request) {
  return handle(async () => {
    const { companyId } = await requireActor();
    const params = Object.fromEntries(new URL(request.url).searchParams);
    return NextResponse.json(await searchCustomers(getDb(), companyId, params));
  });
}

export function POST(request: Request) {
  return handle(async () => {
    const { companyId } = await requireActor();
    const body = await request.json();
    return NextResponse.json(await createCustomer(getDb(), companyId, body), { status: 201 });
  });
}
