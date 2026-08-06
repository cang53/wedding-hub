"use server";

import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import type { SavingsContributor } from "@/types/db";

const VALID_CONTRIBUTORS: SavingsContributor[] = ["bride", "groom", "both"];

function parseInput(form: FormData) {
  const amountStr = String(form.get("amount") ?? "").trim();
  const amount = parseFloat(amountStr);
  const saved_on = String(form.get("saved_on") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const source = String(form.get("source") ?? "").trim() || null;
  const notes = String(form.get("notes") ?? "").trim() || null;
  const contributor = (String(form.get("contributor") ?? "both")) as SavingsContributor;

  if (!amountStr || Number.isNaN(amount) || amount < 0) {
    return { error: "Please enter a valid amount." };
  }
  if (!VALID_CONTRIBUTORS.includes(contributor)) {
    return { error: "Invalid contributor." };
  }
  return { amount, saved_on, source, notes, contributor };
}

export async function createSavingEntry(_prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("wedding_savings")
    .insert(parsed as never)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function updateSavingEntry(id: string, _prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("wedding_savings")
    .update(parsed as never)
    .eq("id", id)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function deleteSavingEntry(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("wedding_savings").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}
