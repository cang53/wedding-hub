import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import { AgendaClient } from "./agenda-client";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("agenda")
    .select("*")
    .order("date", { ascending: true });

  return <AgendaClient initialEvents={data ?? []} />;
}
