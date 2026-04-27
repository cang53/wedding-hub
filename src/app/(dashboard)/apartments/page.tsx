import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import { ApartmentsClient } from "./apartments-client";


export const dynamic = "force-dynamic";

export default async function ApartmentsPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("apartments").select("*").order("rating", { ascending: false });
  return <ApartmentsClient initialItems={data ?? []} />;
}
