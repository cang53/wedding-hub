"use server";

import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import type { GuestRsvp, GuestSide } from "@/types/db";

const VALID_SIDES: GuestSide[] = ["bride", "groom", "both"];
const VALID_RSVP: GuestRsvp[] = ["pending", "yes", "no"];

function parseInput(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const side = String(form.get("side") ?? "both") as GuestSide;
  const category = String(form.get("category") ?? "").trim() || null;
  const guest_group = String(form.get("guest_group") ?? "").trim() || null;
  const plus_one = form.get("plus_one") === "true";
  const plus_one_name = String(form.get("plus_one_name") ?? "").trim() || null;
  const rsvp = String(form.get("rsvp") ?? "pending") as GuestRsvp;
  const invited = form.get("invited") === "true";
  const email = String(form.get("email") ?? "").trim() || null;
  const phone = String(form.get("phone") ?? "").trim() || null;

  if (!name) return { error: "Please enter a name." };
  if (!VALID_SIDES.includes(side)) return { error: "Invalid side." };
  if (!VALID_RSVP.includes(rsvp)) return { error: "Invalid RSVP status." };

  return { name, side, category, guest_group, plus_one, plus_one_name, rsvp, invited, email, phone };
}

export async function createGuest(_prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("guests").insert(parsed as never);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function updateGuest(id: string, _prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("guests").update(parsed as never).eq("id", id);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function deleteGuest(id: string) {
  const supabase = createSupabaseServerClient();
  await supabase.from("guests").delete().eq("id", id);
}
