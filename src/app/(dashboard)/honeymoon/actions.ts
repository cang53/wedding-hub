"use server";

import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import type { HoneymoonRow } from "@/types/db";

function parseInput(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const country = String(form.get("country") ?? "").trim() || null;
  const budget = parseFloat(String(form.get("budget") ?? "")) || null;
  const duration = String(form.get("duration") ?? "").trim() || null;
  const best_time = String(form.get("best_time") ?? "").trim() || null;
  const notes = String(form.get("notes") ?? "").trim() || null;
  const link = String(form.get("link") ?? "").trim() || null;
  const start_date = String(form.get("start_date") ?? "").trim() || null;
  const end_date = String(form.get("end_date") ?? "").trim() || null;

  if (!name) return { error: "Please enter a destination name." };
  return { name, country, budget, duration, best_time, notes, link, start_date, end_date };
}

export async function createDestination(_prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("honeymoon").insert({ ...parsed, favorite: false, images: null } as never).select().single();
  if (error) return { error: error.message };
  return { ok: true as const, data: data as HoneymoonRow };
}

export async function updateDestination(id: string, _prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("honeymoon").update(parsed as never).eq("id", id).select().single();
  if (error) return { error: error.message };
  return { ok: true as const, data: data as HoneymoonRow };
}

export async function toggleFavorite(id: string, favorite: boolean) {
  const supabase = createSupabaseServerClient();
  await supabase.from("honeymoon").update({ favorite } as never).eq("id", id);
}

export async function deleteDestination(id: string) {
  const supabase = createSupabaseServerClient();
  await supabase.from("honeymoon").delete().eq("id", id);
}
