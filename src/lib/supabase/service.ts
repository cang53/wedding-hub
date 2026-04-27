import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for Server Actions only.
 * Bypasses RLS — never import this in client components or expose to browser.
 */
export function createSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
