import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import { LifeBudgetClient } from "./life-budget-client";
import type { LifeSettingsRow } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function LifeBudgetPage() {
  const supabase = createSupabaseServerClient();
  const [incomeRes, expensesRes, purchasesRes, optionsRes, settingsRes, savingsRes] = await Promise.all([
    supabase.from("life_income").select("*").order("created_at", { ascending: false }),
    supabase.from("life_expenses").select("*").order("created_at", { ascending: false }),
    supabase.from("life_purchases").select("*").order("target_month", { ascending: true }),
    supabase.from("life_purchase_options").select("*").order("created_at", { ascending: true }),
    supabase.from("life_settings").select("*").eq("id", true).single(),
    supabase.from("wedding_savings").select("*").order("saved_on", { ascending: false }),
  ]);

  // Fall back to a default settings row if for some reason the singleton is missing.
  const settings: LifeSettingsRow = settingsRes.data ?? {
    id: true,
    start_month: "2026-09",
    horizon_months: 24,
    starting_cash_mode: "from_wedding",
    starting_cash_manual: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <LifeBudgetClient
      initialIncome={incomeRes.data ?? []}
      initialExpenses={expensesRes.data ?? []}
      initialPurchases={purchasesRes.data ?? []}
      initialPurchaseOptions={optionsRes.data ?? []}
      initialSettings={settings}
      initialSavings={savingsRes.data ?? []}
    />
  );
}

