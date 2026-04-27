import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ApartmentsClient } from "./apartments-client";

export default async function ApartmentsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("apartments").select("*").order("rating", { ascending: false });
  return <ApartmentsClient initialItems={data ?? []} />;
}
