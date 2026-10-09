import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { getAgentReportPdf } from "@/server/reports";

export function GET(request: Request) {
  return handle(async () => {
    const actor = await requireAdmin();
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const { report, pdf } = await getAgentReportPdf(getDb(), actor, params);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="reporte-agentes-${report.from}_${report.to}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}
