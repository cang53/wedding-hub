import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import type { GuestRow } from "@/types/db";
import { GuestStats } from "./guest-stats";

export const dynamic = "force-dynamic";

export default async function GuestStatsPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("guests").select("*").order("name", { ascending: true });
  return <GuestStats guests={(data ?? []) as GuestRow[]} />;
}
