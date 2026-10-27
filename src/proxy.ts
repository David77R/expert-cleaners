import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cleanEnvValue, cleanSupabaseUrl } from "@/lib/clean-env";

const PUBLIC_PATHS = ["/login"];
const OPEN_PATHS = ["/reservar", "/api/public/"];

export async function proxy(request: NextRequest) {
  if (OPEN_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))) return NextResponse.next();
  const url = cleanSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno");
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  let supabase: ReturnType<typeof createServerClient>;
  try {
    supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
  } catch (error) {
    console.error(
      `NEXT_PUBLIC_SUPABASE_URL no es una URL válida (empieza por «${url.slice(0, 12)}»). Debe ser https://<proyecto>.supabase.co`,
      error,
    );
    return new NextResponse("Configuración del servidor incompleta. Avisa al administrador.", { status: 500 });
  }

  let user: unknown = null;
  try {
    const { data } = await supabase.auth.getClaims();
    user = data?.claims?.sub ?? null;
  } catch (error) {
    console.error("No se pudo validar la sesión con Supabase", error);
  }
  const data = { user };
  if (request.nextUrl.pathname.startsWith("/salir")) return response;
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!data.user && !isPublic) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (data.user && isPublic) return NextResponse.redirect(new URL("/inicio", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|clients/).*)"],
};
