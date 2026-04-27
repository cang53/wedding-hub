import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GuestsClient } from "./guests-client";

export default async function GuestsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("guests").select("*").order("name", { ascending: true });
  return <GuestsClient initialGuests={data ?? []} />;
}
