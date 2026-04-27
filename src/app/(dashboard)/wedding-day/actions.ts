"use server";

import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";

function parseInput(form: FormData) {
  const title = String(form.get("title") ?? "").trim();
  const start_time = String(form.get("start_time") ?? "").trim();
  const end_time = String(form.get("end_time") ?? "").trim();
  const location = String(form.get("location") ?? "").trim() || null;
  const notes = String(form.get("notes") ?? "").trim() || null;

  if (!title) return { error: "Please enter a title." };
  if (!start_time) return { error: "Please enter a start time." };
  if (!end_time) return { error: "Please enter an end time." };

  return { title, start_time, end_time, location, notes };
}

export async function createWeddingDayEvent(_prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("wedding_day_events").insert(parsed as never);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function updateWeddingDayEvent(id: string, _prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("wedding_day_events").update(parsed as never).eq("id", id);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function deleteWeddingDayEvent(id: string) {
  const supabase = createSupabaseServerClient();
  await supabase.from("wedding_day_events").delete().eq("id", id);
}
