import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import { WeddingDayClient } from "./wedding-day-client";


export const dynamic = "force-dynamic";

export default async function WeddingDayPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("wedding_day_events").select("*").order("start_time", { ascending: true });
  return <WeddingDayClient initialItems={data ?? []} />;
}
