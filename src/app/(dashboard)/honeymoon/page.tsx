import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import { HoneymoonClient } from "./honeymoon-client";


export const dynamic = "force-dynamic";

export default async function HoneymoonPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("honeymoon").select("*").order("created_at", { ascending: false });
  return <HoneymoonClient initialItems={data ?? []} />;
}
