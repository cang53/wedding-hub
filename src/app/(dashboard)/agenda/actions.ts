"use server";

import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";

type AgendaInput = {
  title: string;
  date: string; // ISO timestamptz
  all_day: boolean;
  location: string | null;
  notes: string | null;
};

function parseInput(form: FormData): AgendaInput | { error: string } {
  const title = String(form.get("title") ?? "").trim();
  const dateRaw = String(form.get("date") ?? "").trim(); // YYYY-MM-DD
  const timeRaw = String(form.get("time") ?? "").trim(); // HH:MM, optional
  const location = String(form.get("location") ?? "").trim() || null;
  const notes = String(form.get("notes") ?? "").trim() || null;

  if (!title) return { error: "Please enter a title." };
  if (!dateRaw) return { error: "Please pick a date." };

  const all_day = !timeRaw;

  // Build an ISO timestamp. If no time was given, store midnight UTC and
  // flag all_day so the UI can render just the date.
  const isoTime = all_day ? "00:00:00" : `${timeRaw}:00`;
  const iso = new Date(`${dateRaw}T${isoTime}${all_day ? "Z" : ""}`).toISOString();

  if (Number.isNaN(new Date(iso).getTime())) {
    return { error: "Invalid date or time." };
  }

  return { title, date: iso, all_day, location, notes };
}

export async function createAgendaEvent(_prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  // See note in todo/actions.ts about the `as never` cast.
  const { error } = await supabase.from("agenda").insert(parsed as never);

  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function updateAgendaEvent(id: string, _prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("agenda")
    .update(parsed as never)
    .eq("id", id);

  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function deleteAgendaEvent(id: string) {
  const supabase = createSupabaseServerClient();
  await supabase.from("agenda").delete().eq("id", id);
}
