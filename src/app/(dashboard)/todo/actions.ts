"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TodoCategory, TodoPriority } from "@/types/db";

export type TodoFormInput = {
  text: string;
  category: TodoCategory;
  priority: TodoPriority;
  due_date: string | null;
};

function parseInput(form: FormData): TodoFormInput | { error: string } {
  const text = String(form.get("text") ?? "").trim();
  const category = String(form.get("category") ?? "wedding") as TodoCategory;
  const priority = String(form.get("priority") ?? "medium") as TodoPriority;
  const dueRaw = String(form.get("due_date") ?? "").trim();

  if (!text) return { error: "Please enter a task." };
  if (!["wedding", "honeymoon", "home", "personal"].includes(category)) {
    return { error: "Invalid category." };
  }
  if (!["low", "medium", "high"].includes(priority)) {
    return { error: "Invalid priority." };
  }

  return {
    text,
    category,
    priority,
    due_date: dueRaw ? dueRaw : null,
  };
}

export async function createTodo(_prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createSupabaseServerClient();
  // `as never` cast: supabase-js v2.49+ infers a strict Insert type that
  // can collapse to `never` when no Database generic is supplied. The
  // runtime accepts the object fine; this just tells TS to relax.
  const { error } = await supabase.from("todos").insert({
    ...parsed,
    done: false,
  } as never);

  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function updateTodo(id: string, _prev: unknown, form: FormData) {
  const parsed = parseInput(form);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("todos")
    .update(parsed as never)
    .eq("id", id);

  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function toggleTodo(id: string, done: boolean) {
  const supabase = await createSupabaseServerClient();
  await supabase.from("todos").update({ done } as never).eq("id", id);
}

export async function deleteTodo(id: string) {
  const supabase = await createSupabaseServerClient();
  await supabase.from("todos").delete().eq("id", id);
}
