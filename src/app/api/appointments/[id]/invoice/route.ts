import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireActor } from "@/server/auth";
import { handle } from "@/server/http";
import { getInvoicePdf } from "@/server/invoices";

export function GET(_request: Request, ctx: RouteContext<"/api/appointments/[id]/invoice">) {
  return handle(async () => {
    const { companyId } = await requireActor();
    const { id } = await ctx.params;
    const { invoice, pdf } = await getInvoicePdf(getDb(), companyId, id);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}
