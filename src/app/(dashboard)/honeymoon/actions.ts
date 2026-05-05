"use server";

import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import type { HoneymoonRow } from "@/types/db";
import { v4 as uuid } from "uuid";

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

export async function uploadHoneymoonImages(destinationId: string, formData: FormData) {
  const supabase = createSupabaseServerClient();
  const files = formData.getAll("images") as File[];

  // If no files, just return the current destination
  if (!files || files.length === 0) {
    const { data } = await supabase.from("honeymoon").select("*").eq("id", destinationId).single();
    return { ok: true as const, data: data as HoneymoonRow };
  }

  const uploadedUrls: string[] = [];

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      continue; // Skip non-image files
    }

    const fileName = `${destinationId}/${uuid()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from("honeymoon-images")
      .upload(fileName, file);

    if (error) {
      console.error("Upload error:", error);
      continue;
    }

    if (data) {
      const { data: urlData } = supabase.storage
        .from("honeymoon-images")
        .getPublicUrl(fileName);
      if (urlData) {
        uploadedUrls.push(urlData.publicUrl);
      }
    }
  }

  // If no images uploaded, just return current destination
  if (uploadedUrls.length === 0) {
    const { data } = await supabase.from("honeymoon").select("*").eq("id", destinationId).single();
    return { ok: true as const, data: data as HoneymoonRow };
  }

  // Get current images from the destination
  const { data: current } = await supabase
    .from("honeymoon")
    .select("images")
    .eq("id", destinationId)
    .single();

  const currentImages = current?.images ? JSON.parse(current.images) : [];
  const allImages = [...currentImages, ...uploadedUrls];

  // Update destination with new images
  const { data, error: updateError } = await supabase
    .from("honeymoon")
    .update({ images: JSON.stringify(allImages) })
    .eq("id", destinationId)
    .select()
    .single();

  if (updateError) {
    return { error: updateError.message };
  }

  return { ok: true as const, data: data as HoneymoonRow };
}

export async function deleteHoneymoonImage(destinationId: string, imageUrl: string) {
  const supabase = createSupabaseServerClient();

  // Get current images
  const { data: current } = await supabase
    .from("honeymoon")
    .select("images")
    .eq("id", destinationId)
    .single();

  const currentImages = current?.images ? JSON.parse(current.images) : [];
  const updatedImages = currentImages.filter((url: string) => url !== imageUrl);

  // Update destination
  const { data, error } = await supabase
    .from("honeymoon")
    .update({ images: updatedImages.length > 0 ? JSON.stringify(updatedImages) : null })
    .eq("id", destinationId)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  return { ok: true as const, data: data as HoneymoonRow };
}
