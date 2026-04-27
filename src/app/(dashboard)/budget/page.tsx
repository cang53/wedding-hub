import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BudgetClient } from "./budget-client";

export default async function BudgetPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("budget").select("*").order("created_at", { ascending: false });
  return <BudgetClient initialItems={data ?? []} />;
}
