import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const target = new URL("/login", request.url);
  if (request.nextUrl.searchParams.get("motivo") === "empresa") target.searchParams.set("aviso", "empresa");
  return NextResponse.redirect(target);
}
