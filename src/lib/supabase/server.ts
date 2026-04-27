import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 *
 * Uses Next's request-scoped cookies() store so each request gets its own
 * client with the right session. Setting cookies during a Server Component
 * render will throw — that's expected. Only Server Actions and Route Handlers
 * mutate cookies (e.g. on signInWithOtp / exchangeCodeForSession).
 */
type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components can't set cookies — middleware refreshes the
            // session for those calls instead. Safe to ignore here.
          }
        },
      },
    }
  );
}
