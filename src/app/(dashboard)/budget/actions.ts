"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BudgetStatus } from "@/types/db";

const VALID_STATUSES: BudgetStatus[] = ["pending", "deposit", "paid"];

function parseInput(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const category = String(form.get("category") ?? "").trim() || null;
  const status = String(form.get("status") ?? "pending") as BudgetStatus;
  const vendor = String(form.get("vendor") ?? "").trim() || null;
  const estimated = parseFloat(String(form.get("estimated") ?? "")) || null;
  const paid = parseFloat(String(form.get("paid") ?? "")) || null;

  if (!name) return { error: "Please enter an item name." };
  if (!VALID_STATUSES.includes(status)) return { error: "Invalid status." };

  return { name, category, status, vendor, estimated, paid };
}

export async function createBudgetItem(_prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("budget").insert(parsed as never);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function updateBudgetItem(id: string, _prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("budget").update(parsed as never).eq("id", id);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function deleteBudgetItem(id: string) {
  const supabase = await createSupabaseServerClient();
  await supabase.from("budget").delete().eq("id", id);
}
