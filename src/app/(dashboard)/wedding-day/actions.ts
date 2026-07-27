"use server";

import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import type { WeddingDayAssignee } from "@/types/db";

function parseInput(form: FormData) {
  const title = String(form.get("title") ?? "").trim();
  const start_time = String(form.get("start_time") ?? "").trim();
  const end_time = String(form.get("end_time") ?? "").trim();
  const location = String(form.get("location") ?? "").trim() || null;
  const notes = String(form.get("notes") ?? "").trim() || null;
  const assigneeRaw = String(form.get("assignee") ?? "both").trim();
  const assignee: WeddingDayAssignee =
    assigneeRaw === "bride" || assigneeRaw === "groom" ? assigneeRaw : "both";

  if (!title) return { error: "Please enter a title." };
  if (!start_time) return { error: "Please enter a start time." };
  if (!end_time) return { error: "Please enter an end time." };

  return { title, start_time, end_time, location, notes, assignee };
}

export async function createWeddingDayEvent(_prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("wedding_day_events")
    .insert(parsed as never)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function updateWeddingDayEvent(id: string, _prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("wedding_day_events")
    .update(parsed as never)
    .eq("id", id)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function deleteWeddingDayEvent(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("wedding_day_events").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}
