import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_KEY, isDbConfigured } from "@/lib/server-supabase";

/**
 * Auth gate. When the database is configured, anonymous visitors are sent to
 * /login and signed-in users visiting /login are sent to /home. While the DB
 * is unset the app stays an open, sample-data workspace.
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
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = pathname === "/login" || pathname.startsWith("/login");

  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthPage) {
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