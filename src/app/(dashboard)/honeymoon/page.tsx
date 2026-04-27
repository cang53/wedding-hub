import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HoneymoonClient } from "./honeymoon-client";

export default async function HoneymoonPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("honeymoon").select("*").order("created_at", { ascending: false });
  return <HoneymoonClient initialItems={data ?? []} />;
}
