"use server";

import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import type {
  TripScenarioRow,
  TripStageRow,
  StageAccommodationRow,
} from "@/types/db";
import type { ScenarioWithStages } from "./types";

type Result<T> = { error: string } | { ok: true; data: T };
type VoidResult = { error: string } | { ok: true };

// ============================================================================
// Trip Scenario Planner — CRUD server actions
//
// All actions use the service-role client (bypasses RLS); auth gating happens
// at the middleware level. The client holds optimistic state and reconciles
// with the rows returned here.
// ============================================================================

// ---- Scenarios -------------------------------------------------------------

export async function createScenario(
  patch: Partial<TripScenarioRow> & { name: string },
): Promise<Result<TripScenarioRow>> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("trip_scenarios")
    .insert(patch as never)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data: data as TripScenarioRow };
}

export async function updateScenario(id: string, patch: Partial<TripScenarioRow>): Promise<Result<TripScenarioRow>> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("trip_scenarios")
    .update(patch as never)
    .eq("id", id)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data: data as TripScenarioRow };
}

export async function deleteScenario(id: string): Promise<VoidResult> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("trip_scenarios").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true as const };
}

/** Mark one scenario as the final plan; clears the flag on every other. */
export async function selectScenarioAsFinal(id: string): Promise<Result<TripScenarioRow>> {
  const supabase = createSupabaseServerClient();
  // Clear all first to respect the partial unique index, then set the winner.
  const { error: clearErr } = await supabase
    .from("trip_scenarios")
    .update({ is_selected: false } as never)
    .neq("id", id);
  if (clearErr) return { error: clearErr.message };

  const { data, error } = await supabase
    .from("trip_scenarios")
    .update({ is_selected: true } as never)
    .eq("id", id)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data: data as TripScenarioRow };
}

/** Deep-clone a scenario with all its stages and accommodations. */
export async function duplicateScenario(id: string): Promise<Result<ScenarioWithStages>> {
  const supabase = createSupabaseServerClient();

  const { data: source, error: srcErr } = await supabase
    .from("trip_scenarios")
    .select("*")
    .eq("id", id)
    .single();
  if (srcErr || !source) return { error: srcErr?.message ?? "Scenario not found" };

  const src = source as TripScenarioRow;
  const { data: created, error: insErr } = await supabase
    .from("trip_scenarios")
    .insert({
      name: `${src.name} (copy)`,
      description: src.description,
      promo_code: src.promo_code,
      promo_amount: src.promo_amount,
      color: src.color,
      is_selected: false,
    } as never)
    .select()
    .single();
  if (insErr || !created) return { error: insErr?.message ?? "Copy failed" };
  const newScenario = created as TripScenarioRow;

  const { data: stages, error: stagesErr } = await supabase
    .from("trip_stages")
    .select("*")
    .eq("scenario_id", id)
    .order("order_index", { ascending: true });
  if (stagesErr) return { error: stagesErr.message };

  for (const stage of (stages ?? []) as TripStageRow[]) {
    const { data: newStage, error: stageErr } = await supabase
      .from("trip_stages")
      .insert({
        scenario_id: newScenario.id,
        order_index: stage.order_index,
        name: stage.name,
        destination: stage.destination,
        nights: stage.nights,
        date_from: stage.date_from,
        date_to: stage.date_to,
        notes: stage.notes,
        emoji: stage.emoji,
      } as never)
      .select()
      .single();
    // Bail rather than continue: a silently skipped stage produces a copy
    // that looks complete but is missing part of the itinerary.
    if (stageErr || !newStage) return { error: stageErr?.message ?? "Copying a stage failed" };

    const { data: accs, error: accsErr } = await supabase
      .from("stage_accommodations")
      .select("*")
      .eq("stage_id", stage.id);
    if (accsErr) return { error: accsErr.message };

    const rows = ((accs ?? []) as StageAccommodationRow[]).map((a) => ({
      stage_id: (newStage as TripStageRow).id,
      name: a.name,
      platform: a.platform,
      url: a.url,
      price_total: a.price_total,
      price_per_night: a.price_per_night,
      rating: a.rating,
      rating_count: a.rating_count,
      breakfast: a.breakfast,
      pool: a.pool,
      ac: a.ac,
      halal_nearby: a.halal_nearby,
      pros: a.pros,
      cons: a.cons,
      notes: a.notes,
      is_chosen: a.is_chosen,
      image_url: a.image_url,
    }));
    if (rows.length > 0) {
      const { error: accInsErr } = await supabase.from("stage_accommodations").insert(rows as never);
      if (accInsErr) return { error: accInsErr.message };
    }
  }

  // Return the full nested clone so the client can render it immediately.
  const { data: tree, error: treeErr } = await supabase
    .from("trip_scenarios")
    .select("*, stages:trip_stages(*, accommodations:stage_accommodations(*))")
    .eq("id", newScenario.id)
    .order("order_index", { referencedTable: "trip_stages", ascending: true })
    .single();

  // The clone itself succeeded by this point; if only the read-back failed,
  // hand back the bare scenario so the client still shows the new copy.
  if (treeErr && !tree) return { ok: true as const, data: { ...newScenario, stages: [] } as ScenarioWithStages };

  return { ok: true as const, data: (tree ?? { ...newScenario, stages: [] }) as ScenarioWithStages };
}

// ---- Stages ----------------------------------------------------------------

export async function createStage(
  scenarioId: string,
  patch: Partial<TripStageRow> & { name: string },
): Promise<Result<TripStageRow>> {
  const supabase = createSupabaseServerClient();
  // Append to the end by default.
  const { count } = await supabase
    .from("trip_stages")
    .select("id", { count: "exact", head: true })
    .eq("scenario_id", scenarioId);
  const { data, error } = await supabase
    .from("trip_stages")
    .insert({ order_index: count ?? 0, ...patch, scenario_id: scenarioId } as never)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data: data as TripStageRow };
}

export async function updateStage(id: string, patch: Partial<TripStageRow>): Promise<Result<TripStageRow>> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("trip_stages")
    .update(patch as never)
    .eq("id", id)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data: data as TripStageRow };
}

export async function deleteStage(id: string): Promise<VoidResult> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("trip_stages").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true as const };
}

/** Persist a new stage order. `orderedIds` is the full list top-to-bottom. */
export async function reorderStages(orderedIds: string[]): Promise<VoidResult> {
  const supabase = createSupabaseServerClient();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("trip_stages").update({ order_index: index } as never).eq("id", id),
    ),
  );
  // A partial failure leaves the order half-applied, so report the first one
  // rather than letting the client believe the reorder stuck.
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };
  return { ok: true as const };
}

// ---- Accommodations --------------------------------------------------------

export async function createAccommodation(
  stageId: string,
  patch: Partial<StageAccommodationRow> & { name: string },
): Promise<Result<StageAccommodationRow>> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stage_accommodations")
    .insert({ ...patch, stage_id: stageId } as never)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data: data as StageAccommodationRow };
}

export async function updateAccommodation(
  id: string,
  patch: Partial<StageAccommodationRow>,
): Promise<Result<StageAccommodationRow>> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stage_accommodations")
    .update(patch as never)
    .eq("id", id)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data: data as StageAccommodationRow };
}

export async function deleteAccommodation(id: string): Promise<VoidResult> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("stage_accommodations").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true as const };
}

/** Choose one accommodation for a stage; unsets every other in the same stage. */
export async function chooseAccommodation(stageId: string, accommodationId: string): Promise<Result<StageAccommodationRow>> {
  const supabase = createSupabaseServerClient();
  // Clear all first to respect the per-stage partial unique index.
  const { error: clearErr } = await supabase
    .from("stage_accommodations")
    .update({ is_chosen: false } as never)
    .eq("stage_id", stageId);
  if (clearErr) return { error: clearErr.message };

  const { data, error } = await supabase
    .from("stage_accommodations")
    .update({ is_chosen: true } as never)
    .eq("id", accommodationId)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data: data as StageAccommodationRow };
}
