import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_KEY, isDbConfigured } from "@/lib/server-supabase";

/**
 * Auth gate. Uses a local session-cookie check (no network round-trip) so
 * every navigation doesn't pay an edge→Supabase hop. Security still holds:
 * every table policy requires the authenticated role, so a forged or stale
 * cookie can never read or write data — RLS rejects it at the database.
 * Identity is re-verified with getUser() in pages and server actions.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isDbConfigured) {
    return NextResponse.next();
  }

  let response = NextResponse.next();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        response = NextResponse.next({ request: request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const expired =
    session?.expires_at != null && session.expires_at * 1000 <= Date.now();
  const signedIn = !!session && !expired;

  const isAuthPage = pathname === "/login" || pathname.startsWith("/login");

  if (!signedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (signedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Exclude static assets, images, and metadata files.
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};