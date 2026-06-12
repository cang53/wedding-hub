import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import { HoneymoonClient } from "./honeymoon-client";
import type { ScenarioWithStages } from "./types";

export const dynamic = "force-dynamic";

export default async function HoneymoonPage() {
  const supabase = createSupabaseServerClient();

  // One nested query: scenarios → stages → accommodations.
  const { data } = await supabase
    .from("trip_scenarios")
    .select("*, stages:trip_stages(*, accommodations:stage_accommodations(*))")
    .order("created_at", { ascending: true })
    .order("order_index", { referencedTable: "trip_stages", ascending: true });

  // Sort accommodations within each stage for stable rendering (chosen first).
  const scenarios = ((data ?? []) as ScenarioWithStages[]).map((s) => ({
    ...s,
    stages: (s.stages ?? []).map((st) => ({
      ...st,
      accommodations: [...(st.accommodations ?? [])].sort((a, b) => {
        if (a.is_chosen !== b.is_chosen) return a.is_chosen ? -1 : 1;
        return a.created_at.localeCompare(b.created_at);
      }),
    })),
  }));

  return <HoneymoonClient initialScenarios={scenarios} />;
}
