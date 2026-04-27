import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Magic-link callback.
 *
 * Flow:
 *   1. Supabase redirects here with `?code=...` after the user clicks
 *      the email link (or `?token_hash` + `?type` for PKCE-less flows).
 *   2. We exchange the code for a session — sets the auth cookies.
 *   3. We then check is_allowed() against the now-authenticated user.
 *   4. If they're not on the list, sign them out and bounce to /auth/error.
 *   5. Otherwise, redirect to ?next= (or /dashboard).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const errorDescription = searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${encodeURIComponent(errorDescription)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?reason=missing_code`);
  }

  const supabase = await createSupabaseServerClient();

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${encodeURIComponent(exchangeError.message)}`
    );
  }

  // Verify the now-authenticated user is on the allowlist.
  // is_allowed() reads auth.jwt() server-side — see the migration.
  const { data: allowed, error: rpcError } = await supabase.rpc("is_allowed");
  if (rpcError) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${encodeURIComponent(rpcError.message)}`
    );
  }

  if (!allowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth/error?reason=not_allowed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
