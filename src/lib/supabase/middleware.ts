import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request session refresh + auth gate.
 *
 * Called from the root middleware.ts. Returns a NextResponse that either
 * passes through (with refreshed cookies) or redirects to /login.
 *
 * Public routes: /login, /auth/callback, /auth/error, plus /_next and
 * static assets (filtered out by the matcher in middleware.ts).
 */
const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/error"];

type CookieToSet = { name: string; value: string; options?: CookieOptions };

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run any code between createServerClient() and
  // supabase.auth.getUser(). Supabase's auth helpers expect this call to
  // happen first so the cookie chunks get refreshed before any other logic.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Authed user hitting /login → bounce to dashboard.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Unauthed user hitting a private route → bounce to /login.
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
