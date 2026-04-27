"use server";

import { redirect } from "next/navigation";
import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";

export async function signOutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
