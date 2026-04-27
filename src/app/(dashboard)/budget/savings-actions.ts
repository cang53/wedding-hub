"use server";

import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";

function parseInput(form: FormData) {
  const amountStr = String(form.get("amount") ?? "").trim();
  const amount = parseFloat(amountStr);
  const saved_on = String(form.get("saved_on") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const source = String(form.get("source") ?? "").trim() || null;
  const notes = String(form.get("notes") ?? "").trim() || null;

  if (!amountStr || Number.isNaN(amount) || amount < 0) {
    return { error: "Please enter a valid amount." };
  }
  return { amount, saved_on, source, notes };
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

export async function deleteSavingEntry(id: string) {
  const supabase = createSupabaseServerClient();
  await supabase.from("wedding_savings").delete().eq("id", id);
}
