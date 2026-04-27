import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import { BudgetClient } from "./budget-client";


export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("budget").select("*").order("created_at", { ascending: false });
  return <BudgetClient initialItems={data ?? []} />;
}
