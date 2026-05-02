"use server";

import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import type { LifePerson, StartingCashMode } from "@/types/db";

const VALID_PERSONS: LifePerson[] = ["bride", "groom", "both"];

function trimMonth(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  // Accept "YYYY-MM" or "YYYY-MM-DD" (HTML month input gives YYYY-MM, date input gives YYYY-MM-DD).
  return s.slice(0, 7);
}

function parsePayerSplit(form: FormData) {
  const payer = String(form.get("payer") ?? "both") as LifePerson;
  const rawPct = parseFloat(String(form.get("payer_groom_pct") ?? "50"));
  const payer_groom_pct = payer === "both" ? (isNaN(rawPct) ? 50 : Math.min(100, Math.max(0, rawPct))) : null;
  return { payer, payer_groom_pct };
}

// ---- Income --------------------------------------------------------------

function parseIncome(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const amount = parseFloat(String(form.get("amount") ?? ""));
  const person = String(form.get("person") ?? "both") as LifePerson;
  const start_month = trimMonth(form.get("start_month"));
  const end_month = trimMonth(form.get("end_month"));
  const notes = String(form.get("notes") ?? "").trim() || null;

  if (!name) return { error: "Please enter a name." };
  if (isNaN(amount) || amount < 0) return { error: "Please enter a valid amount." };
  if (!VALID_PERSONS.includes(person)) return { error: "Invalid person." };

  return { name, amount, person, start_month, end_month, notes };
}

export async function createIncome(_prev: unknown, form: FormData) {
  const parsed = parseIncome(form);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("life_income").insert(parsed as never).select().single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function updateIncome(id: string, _prev: unknown, form: FormData) {
  const parsed = parseIncome(form);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("life_income").update(parsed as never).eq("id", id).select().single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function deleteIncome(id: string) {
  const supabase = createSupabaseServerClient();
  await supabase.from("life_income").delete().eq("id", id);
}

// ---- Recurring expenses --------------------------------------------------

function parseExpense(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const amount = parseFloat(String(form.get("amount") ?? ""));
  const category = String(form.get("category") ?? "").trim() || null;
  const start_month = trimMonth(form.get("start_month"));
  const end_month = trimMonth(form.get("end_month"));
  const notes = String(form.get("notes") ?? "").trim() || null;
  const { payer, payer_groom_pct } = parsePayerSplit(form);

  if (!name) return { error: "Please enter a name." };
  if (isNaN(amount) || amount < 0) return { error: "Please enter a valid amount." };
  if (!VALID_PERSONS.includes(payer)) return { error: "Invalid payer." };

  return { name, amount, category, payer, payer_groom_pct, start_month, end_month, notes };
}

export async function createExpense(_prev: unknown, form: FormData) {
  const parsed = parseExpense(form);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("life_expenses").insert(parsed as never).select().single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function updateExpense(id: string, _prev: unknown, form: FormData) {
  const parsed = parseExpense(form);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("life_expenses").update(parsed as never).eq("id", id).select().single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function deleteExpense(id: string) {
  const supabase = createSupabaseServerClient();
  await supabase.from("life_expenses").delete().eq("id", id);
}

// ---- One-time purchases --------------------------------------------------

function parsePurchase(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const amount = parseFloat(String(form.get("amount") ?? ""));
  const category = String(form.get("category") ?? "").trim() || null;
  const target_month = trimMonth(form.get("target_month"));
  const notes = String(form.get("notes") ?? "").trim() || null;
  const scheduled = String(form.get("scheduled") ?? "true") !== "false";
  const { payer, payer_groom_pct } = parsePayerSplit(form);

  if (!name) return { error: "Please enter a name." };
  if (isNaN(amount) || amount < 0) return { error: "Please enter a valid amount." };
  if (!target_month) return { error: "Please select a target month." };
  if (!VALID_PERSONS.includes(payer)) return { error: "Invalid payer." };

  return { name, amount, category, target_month, payer, payer_groom_pct, scheduled, notes };
}

export async function createPurchase(_prev: unknown, form: FormData) {
  const parsed = parsePurchase(form);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("life_purchases").insert(parsed as never).select().single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function updatePurchase(id: string, _prev: unknown, form: FormData) {
  const parsed = parsePurchase(form);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("life_purchases").update(parsed as never).eq("id", id).select().single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function togglePurchaseScheduled(id: string, scheduled: boolean) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("life_purchases")
    .update({ scheduled } as never)
    .eq("id", id)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function deletePurchase(id: string) {
  const supabase = createSupabaseServerClient();
  await supabase.from("life_purchases").delete().eq("id", id);
}

// ---- Settings ------------------------------------------------------------

export async function updateSettings(form: FormData) {
  const start_month = trimMonth(form.get("start_month")) ?? "2026-09";
  const horizon_months = Math.max(6, Math.min(60, parseInt(String(form.get("horizon_months") ?? "24"), 10) || 24));
  const starting_cash_mode = String(form.get("starting_cash_mode") ?? "from_wedding") as StartingCashMode;
  const starting_cash_manual = Math.max(0, parseFloat(String(form.get("starting_cash_manual") ?? "0")) || 0);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("life_settings")
    .update({ start_month, horizon_months, starting_cash_mode, starting_cash_manual } as never)
    .eq("id", true)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}
