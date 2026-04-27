import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import { GuestsClient } from "./guests-client";


export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("guests").select("*").order("name", { ascending: true });
  return <GuestsClient initialGuests={data ?? []} />;
}
