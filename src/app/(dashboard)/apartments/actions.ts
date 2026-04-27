"use server";

import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import type { ApartmentStatus } from "@/types/db";

const VALID_STATUSES: ApartmentStatus[] = ["interested", "visited", "applied", "rejected"];

function parseInput(form: FormData) {
  const title = String(form.get("title") ?? "").trim();
  const address = String(form.get("address") ?? "").trim() || null;
  const rent = parseFloat(String(form.get("rent") ?? "")) || null;
  const charges = parseFloat(String(form.get("charges") ?? "")) || null;
  const size = parseFloat(String(form.get("size") ?? "")) || null;
  const bedrooms = parseInt(String(form.get("bedrooms") ?? "")) || null;
  const pros = String(form.get("pros") ?? "").trim() || null;
  const cons = String(form.get("cons") ?? "").trim() || null;
  const status = String(form.get("status") ?? "interested") as ApartmentStatus;
  const rating = parseInt(String(form.get("rating") ?? "0")) || 0;
  const link = String(form.get("link") ?? "").trim() || null;

  if (!title) return { error: "Please enter a title." };
  if (!VALID_STATUSES.includes(status)) return { error: "Invalid status." };
  if (rating < 0 || rating > 5) return { error: "Rating must be 0–5." };

  return { title, address, rent, charges, size, bedrooms, pros, cons, status, rating, link };
}

export async function createApartment(_prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("apartments").insert(parsed as never);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function updateApartment(id: string, _prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("apartments").update(parsed as never).eq("id", id);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function deleteApartment(id: string) {
  const supabase = createSupabaseServerClient();
  await supabase.from("apartments").delete().eq("id", id);
}
