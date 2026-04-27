import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import { TodoClient } from "./todo-client";

export const dynamic = "force-dynamic";

export default async function TodoPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("todos")
    .select("*")
    .order("created_at", { ascending: false });

  return <TodoClient initialTodos={data ?? []} />;
}
