"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components and the browser.
 *
 * No `<Database>` generic — hand-written Database types collide with
 * supabase-js v2.49+'s schema discriminator and collapse table types to
 * `never`. We type things explicitly at the consumer side instead, using
 * the row interfaces in `@/types/db` (TodoRow, AgendaRow, etc.).
 *
 * Both env vars are NEXT_PUBLIC_ — exposed to the browser intentionally;
 * RLS on the database is what enforces access.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
