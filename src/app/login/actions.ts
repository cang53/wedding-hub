"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
};

/**
 * Sends a magic-link email via Supabase.
 *
 * We DON'T pre-check the allowlist here — any email gets a magic link.
 * The /auth/callback route then verifies the authenticated email against
 * `allowed_emails` and signs the user out if they're not on the list.
 *
 * This is a deliberate trade-off: skipping the pre-check means a non-allowed
 * email may receive an unusable magic link (minor UX wart), but it avoids
 * exposing an "is this email allowlisted?" probe endpoint to anonymous
 * users. Defense-in-depth is in the callback + RLS.
 */
export async function signIn(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Please enter a valid email." };
  }

  const supabase = await createSupabaseServerClient();
  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    (headerList.get("host") ? `https://${headerList.get("host")}` : "http://localhost:3000");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { status: "error", message: error.message, email };
  }

  return {
    status: "sent",
    email,
    message: `Magic link sent to ${email}. Check your inbox.`,
  };
}
