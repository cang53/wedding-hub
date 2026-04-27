import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import { BudgetClient } from "./budget-client";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const supabase = createSupabaseServerClient();
  const [budgetRes, savingsRes] = await Promise.all([
    supabase.from("budget").select("*").order("created_at", { ascending: false }),
    supabase.from("wedding_savings").select("*").order("saved_on", { ascending: false }),
  ]);

  return (
    <BudgetClient
      initialBudget={budgetRes.data ?? []}
      initialSavings={savingsRes.data ?? []}
    />
  );
}
