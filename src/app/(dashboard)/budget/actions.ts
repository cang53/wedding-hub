"use server";

import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import type { BudgetPayer, BudgetStatus } from "@/types/db";

const VALID_STATUSES: BudgetStatus[] = ["pending", "deposit", "paid"];
const VALID_PAYERS: BudgetPayer[] = ["bride", "groom", "both"];

function parseInput(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const category = String(form.get("category") ?? "").trim() || null;
  const status = String(form.get("status") ?? "pending") as BudgetStatus;
  const vendor = String(form.get("vendor") ?? "").trim() || null;
  const estimated = parseFloat(String(form.get("estimated") ?? "")) || null;
  const paid = parseFloat(String(form.get("paid") ?? "")) || null;
  const payer = (String(form.get("payer") ?? "both")) as BudgetPayer;
  const rawPct = parseFloat(String(form.get("payer_groom_pct") ?? "50"));
  const payer_groom_pct = payer === "both" ? (isNaN(rawPct) ? 50 : Math.min(100, Math.max(0, rawPct))) : null;

  if (!name) return { error: "Please enter an item name." };
  if (!VALID_STATUSES.includes(status)) return { error: "Invalid status." };
  if (!VALID_PAYERS.includes(payer)) return { error: "Invalid payer." };

  return { name, category, status, vendor, estimated, paid, payer, payer_groom_pct };
}

export async function createBudgetItem(_prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("budget").insert(parsed as never).select().single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function updateBudgetItem(id: string, _prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("budget").update(parsed as never).eq("id", id).select().single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function deleteBudgetItem(id: string) {
  const supabase = createSupabaseServerClient();
  await supabase.from("budget").delete().eq("id", id);
}
